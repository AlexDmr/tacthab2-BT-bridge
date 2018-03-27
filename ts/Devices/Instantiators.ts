import * as noble from "noble";
import {BLEDevice} from "./BLE";

export type BLE_INSTANCIATOR = (p: noble.Peripheral) => BLEDevice;
const instanciators: BLE_INSTANCIATOR[] = [];

export function registerBleInstanciator(fct: BLE_INSTANCIATOR) {
    instanciators.push(fct);
}

export function instantiatePeripheral(p: noble.Peripheral): BLEDevice {
    return instanciators.reduce(
        (device, fct) => device || fct(p),
        undefined as BLEDevice
    );
}
