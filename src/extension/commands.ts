// Define the PybricksCommand enum for all command strings
export enum PybricksCommand {
    ConnectDevice = 'pybricks.connectDevice',
    ConnectDeviceLastConnected = 'pybricks.connectDeviceLastConnected',
    DisconnectDevice = 'pybricks.disconnectDevice',
    CompileAndRun = 'pybricks.compileAndRun',
    StartUserProgram = 'pybricks.startUserProgram',
    StopUserProgram = 'pybricks.stopUserProgram',
    StatusPlaceHolder = 'pybricks.statusPlaceholder',
    SettingsPlaceholder = 'pybricks.folder.settingsPlaceholder',
    ToggleAutoConnect = 'pybricks.toggleAutoConnect',
    ToggleAutoStart = 'pybricks.toggleAutoStart',
    RotateViewsForward = 'pybricks.blocklypyViewer.rotateViewsForward',
    RotateViewsBackward = 'pybricks.blocklypyViewer.rotateViewsBackward',
    DisplayPreview = 'pybricks.blocklypyViewer.displayPreview',
    DisplayPycode = 'pybricks.blocklypyViewer.displayPycode',
    DisplayPseudo = 'pybricks.blocklypyViewer.displayPseudo',
    DisplayGraph = 'pybricks.blocklypyViewer.displayGraph',
}

export const CommandsWithFolder = [PybricksCommand.SettingsPlaceholder];
