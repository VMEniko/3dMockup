import path from "path";

export const CONFIG = {
  DEVICE_CONNECTED: true,
  SCAN_DURATION_SECONDS: 8,
  SUPPORTS_PROGRESS: true,
  MOCK_RESULTS_DIR: path.join(process.cwd(), "mock-data", "results"),
  FORCE_FAILURE: false
};

export type BodyPart = "FOOT" | "LEG" | "ARM" | "TORSO";
export type Side = "LEFT" | "RIGHT";
export type FileFormat = "obj" | "stl" | "drc";

export type DeviceStatus = "CONNECTED" | "NOT_CONNECTED";

export interface ScanRequest {
  bodyPart: BodyPart;
  side: Side;
}

export interface ScanState {
  inProgress: boolean;
  startedAt?: number;
  finishedAt?: number;
  success?: boolean;
  errorMessage?: string;
  request?: ScanRequest;
}

const scanState: ScanState = {
  inProgress: false
};

// State machine:
// - idle: inProgress=false, no active scan
// - scanning: inProgress=true, startedAt set
// - finished success: inProgress=false, success=true
// - finished failure: inProgress=false, success=false, errorMessage set
export function startScan(request: ScanRequest): ScanState {
  scanState.inProgress = true;
  scanState.startedAt = Date.now();
  scanState.finishedAt = undefined;
  scanState.success = undefined;
  scanState.errorMessage = undefined;
  scanState.request = request;
  return { ...scanState };
}

export function getScanState(): ScanState {
  if (scanState.inProgress && scanState.startedAt) {
    const elapsedMs = Date.now() - scanState.startedAt;
    if (elapsedMs >= CONFIG.SCAN_DURATION_SECONDS * 1000) {
      scanState.inProgress = false;
      scanState.finishedAt = Date.now();
      if (CONFIG.FORCE_FAILURE) {
        scanState.success = false;
        scanState.errorMessage = "Scan failed due to a simulated device error.";
      } else {
        scanState.success = true;
        scanState.errorMessage = undefined;
      }
    }
  }
  return { ...scanState };
}

export function getDeviceStatus(): { status: DeviceStatus; deviceName?: string } {
  if (CONFIG.DEVICE_CONNECTED) {
    return { status: "CONNECTED", deviceName: "MockScanner-3000" };
  }
  return { status: "NOT_CONNECTED" };
}

export function getProgress(): number | undefined {
  if (!CONFIG.SUPPORTS_PROGRESS || !scanState.inProgress || !scanState.startedAt) {
    return undefined;
  }
  const elapsedMs = Date.now() - scanState.startedAt;
  const progress = elapsedMs / (CONFIG.SCAN_DURATION_SECONDS * 1000);
  return Math.max(0, Math.min(1, progress));
}

export function isScanReadyForResult(): { ready: boolean; message?: string } {
  const state = getScanState();
  if (!state.startedAt) {
    return { ready: false, message: "No scan has been started." };
  }
  if (state.inProgress) {
    return { ready: false, message: "Scan is still in progress." };
  }
  if (!state.success) {
    return { ready: false, message: state.errorMessage ?? "Scan failed." };
  }
  return { ready: true };
}

export function resetScan(): void {
  scanState.inProgress = false;
  scanState.startedAt = undefined;
  scanState.finishedAt = undefined;
  scanState.success = undefined;
  scanState.errorMessage = undefined;
  scanState.request = undefined;
}

export const VALID_BODY_PARTS: BodyPart[] = ["FOOT", "LEG", "ARM", "TORSO"];
export const VALID_SIDES: Side[] = ["LEFT", "RIGHT"];
export const VALID_FORMATS: FileFormat[] = ["obj", "stl", "drc"];

export function getResultFilename(format: FileFormat): string {
  return `sample.${format}`;
}
