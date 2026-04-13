export type MessageType =
  | 'ACTIVATE_INSPECT_MODE'
  | 'DEACTIVATE_INSPECT_MODE'
  | 'INSPECT_CANCELLED'
  | 'XPATH_CAPTURED'
  | 'CAPTURE_BUG'
  | 'GET_CONSOLE_ERRORS'
  | 'GET_EVIDENCE_DATA'   // background → content: get timeline + env + storage keys
  | 'VALIDATE_XPATHS'    // background → content: validate a list of xpath strings
  | 'XPATHS_VALIDATED'   // background → sidepanel: validation results
  | 'START_RECORDING'    // sidepanel → background → content
  | 'STOP_RECORDING'     // sidepanel → background → content
  | 'RECORDING_STEP'     // content → background → sidepanel
  | 'RECORDING_STOPPED'  // content → background → sidepanel

export interface ExtMessage<T = unknown> {
  type: MessageType
  payload?: T
}
