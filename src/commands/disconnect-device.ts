import { TreeCommands } from '../extension/tree-commands';
import { Device } from '../logic/ble';

export async function disconnectDeviceAsync() {
    if (!Device.Current) {
        throw new Error('No device is currently connected.');
    }

    await Device.disconnectAsync();
    TreeCommands.refresh();
}
