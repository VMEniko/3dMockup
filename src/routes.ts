import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import path from "path";
import {
  CONFIG,
  VALID_BODY_PARTS,
  VALID_FORMATS,
  VALID_SIDES,
  getDeviceStatus,
  getProgress,
  getResultFilename,
  getScanState,
  isScanReadyForResult,
  resetScan,
  startScan,
  type BodyPart,
  type FileFormat,
  type Side
} from "./state";

interface StartScanBody {
  bodyPart: BodyPart;
  side?: Side;
}

interface ScanResultBody {
  fileFormat: FileFormat;
}

const FORMAT_CONTENT_TYPE: Record<FileFormat, string> = {
  obj: "text/plain",
  stl: "application/sla",
  drc: "application/octet-stream"
};

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/getDeviceStatus", async () => {
    return getDeviceStatus();
  });

  app.post(
    "/startScan",
    async (request: FastifyRequest<{ Body: StartScanBody }>, reply: FastifyReply) => {
      const body = request.body;
      const state = getScanState();
      if (state.inProgress) {
        return reply.status(400).send({
          success: false,
          errorCode: 1001,
          message: "Scan already in progress"
        });
      }
      if (!body || !VALID_BODY_PARTS.includes(body.bodyPart)) {
        return reply.status(400).send({
          success: false,
          errorCode: 1002,
          message: "Invalid or missing bodyPart."
        });
      }
      if (body.side && !VALID_SIDES.includes(body.side)) {
        return reply.status(400).send({
          success: false,
          errorCode: 1003,
          message: "Invalid side. Must be LEFT or RIGHT."
        });
      }
      const device = getDeviceStatus();
      if (device.status !== "CONNECTED") {
        return reply.status(200).send({
          success: false,
          errorCode: 2001,
          message: "Device is not connected."
        });
      }

      resetScan();
      startScan({ bodyPart: body.bodyPart, side: body.side });
      return reply.status(200).send({ success: true });
    }
  );

  app.get("/getScanStatus", async () => {
    const state = getScanState();
    if (state.inProgress) {
      const progress = getProgress();
      return {
        inProgress: true,
        ...(progress !== undefined ? { progress } : {})
      };
    }
    if (state.startedAt && state.success) {
      return { inProgress: false, success: true };
    }
    if (state.startedAt && state.success === false) {
      return {
        inProgress: false,
        success: false,
        message: state.errorMessage ?? "Scan failed."
      };
    }
    return {
      inProgress: false,
      success: false,
      message: "No scan has been started."
    };
  });

  app.post(
    "/getScanResult",
    async (request: FastifyRequest<{ Body: ScanResultBody }>, reply: FastifyReply) => {
      const body = request.body;
      if (!body || !VALID_FORMATS.includes(body.fileFormat)) {
        return reply.status(400).send({
          success: false,
          message: "Invalid or missing fileFormat."
        });
      }

      const readiness = isScanReadyForResult();
      if (!readiness.ready) {
        return reply.status(400).send({
          success: false,
          message: readiness.message ?? "Scan not ready."
        });
      }

      const filename = getResultFilename(body.fileFormat);
      const filePath = path.join(CONFIG.MOCK_RESULTS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return reply.status(500).send({
          success: false,
          message: "Result file not found on server."
        });
      }

      reply.header("Content-Type", FORMAT_CONTENT_TYPE[body.fileFormat]);
      reply.header("Content-Disposition", `attachment; filename=\"${filename}\"`);
      return reply.send(fs.createReadStream(filePath));
    }
  );
}
