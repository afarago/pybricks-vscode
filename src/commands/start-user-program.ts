import * as vscode from 'vscode';
import { Device } from '../logic/ble';
import { createLegacyStartUserProgramCommand } from '../pybricks/protocol';

export async function startUserProgramAsync() {
    if (!Device.Current) {
        throw new Error(
            'No device selected. Please connect to a Pybricks device first.',
        );
        return;
    }

    await Device.write(createLegacyStartUserProgramCommand(), false);
}
