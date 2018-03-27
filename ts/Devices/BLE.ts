import * as noble from "noble";
import {BehaviorSubject, Observable} from "@reactivex/rxjs";

const devices: BLEDevice[] = [];

export function getDevices(): BLEDevice[] {
    return devices;
}

export type CharacteristicValue = {
    data: Buffer;
    length: number,
    utf8: string;
};

export type CHARACTERISTIC_NOTIFICATION = {characteristic: noble.Characteristic, data: Buffer};

export class BLEDevice {
    private name: string;
    protected isConnected = new BehaviorSubject<boolean>(false);
    protected notifications = new BehaviorSubject<CHARACTERISTIC_NOTIFICATION>(undefined);
    protected services: noble.Service[];
    protected characteristics: noble.Characteristic[];
    protected cbCharacteristics = new Map<string, (data: Buffer, isNotification: boolean) => void>();

    constructor(protected peripheral: noble.Peripheral) {
        this.name = peripheral.advertisement ? peripheral.advertisement.localName : peripheral.address;
        peripheral.on  ('connect'		, () => {
            this.isConnected.next(true);
        });
        peripheral.once('disconnect'	, function() {
            this.isConnected.next(false);
        });
    }

    async dispose() {
        if(this.isConnected) {
            await this.disconnect();
        }
        this.peripheral = null;
    }

    toJSON() {
        return {
            name: this.name,
            uuid: this.peripheral.uuid,
            isConnected: this.isConnected.getValue(),
            services: this.services ? this.services.map(S => ({
				name: S.name,
				uuid: S.uuid,
				type: S.type
            }) ) : [],
            characteristics: this.characteristics ? this.characteristics.map(C => ({
				name: C.name,
				uuid: C.uuid,
				type: C.type,
				properties: C.properties
            }) ) : []
        };
    }

	getUUID(): string {
		return this.peripheral.uuid;
	}

    getIsConnected(): {connected: boolean, obs: Observable<boolean>} {
        return {
            connected: this.isConnected.getValue(),
            obs: this.isConnected.asObservable()
        }
    }

    getNotifications(): Observable<CHARACTERISTIC_NOTIFICATION> {
        return this.notifications.asObservable().filter(N => !!N);
    }

    getName(): string {
        return this.name;
    }

    async disconnect(): Promise<void> {
        if (this.isConnected.getValue()) {
            return new Promise<void>( (resolve, reject) => {
                this.peripheral.disconnect( (error?) => {
                    if(error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }
    }

    async connect(): Promise<void> {
        if (!this.isConnected.getValue()) {
            return new Promise<void>((resolve, reject) => {
                this.peripheral.connect((err?) => {
                    if (err) {
                        console.error("ERROR connect", err);
                        reject(err);
                    } else {
                        if (this.services === undefined) {
                            this.peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    this.services = services;
                                    this.characteristics = characteristics;
                                    resolve();
                                }
                            });
                        } else {
                            resolve();
                        }
                    }
                });
            });
        }
    }

    async readCharacteristic(uuid: string): Promise<CharacteristicValue> {
        const characteristic = this.characteristics.find( C => C.uuid === uuid );
        if( characteristic ) {
            //console.log( this.characteristics[uuid] );
            return new Promise<CharacteristicValue>( (resolve, reject) => {
                characteristic.read( (error, data) => {
                    // console.log( "error:", error, " data:", data);
                    if (error) {
                        reject(error);
                    } else {
                        resolve( {
                            data	: data,
                            length  : data.length,
                            utf8	: data.toString('ascii')
                        } );
                    }
                });
            });
        }

        return Promise.reject( "no such characteristic" );
    }

    writeCharacteristic(uuid: string, value: Buffer | string): Promise<void> {
        const characteristic = this.characteristics.find( C => C.uuid === uuid );
        // console.log( this.brickId, "writeCharacteristic", uuid, value );
        if( characteristic ) {
            let buffer: Buffer;
            if(value.constructor === Buffer) {
                buffer = value as Buffer;
            } else {
                const str = value as string;
                if( str.indexOf("0x") === 0) {
                    buffer = new Buffer( Buffer.byteLength(value, 'utf8') - 2 );
                    for(let i=0; i<buffer.length; i++) {
                        const index = 2*(i+1);
                        buffer[i] = parseInt( str.slice(index, index+2), 16);
                    }
                } else {
                    buffer = new Buffer( Buffer.byteLength(value, 'utf8') );
                    buffer.write(str, 0);
                }
            }
            // console.log( "\tbuffer:", buffer);
            return new Promise( (resolve, reject) => {
                characteristic.write(buffer, false, (error?) => {
                    // console.log( "error:", error );
                    if(error) {reject(error);} else {resolve();}
                });
            });
        }

        return Promise.reject( `no such characteristic "${uuid}" in BLE device "${this.name}"` );
    }

    notifyCharacteristic(uuid: string, notify: boolean): Promise<void> {
        const characteristic = this.characteristics.find( C => C.uuid === uuid );

        if( characteristic ) {
            // console.log( this.brickId, "notifyCharacteristic", uuid, notify );
            return new Promise<void>( (resolve, reject) => {
                characteristic.notify(notify, (error?) => {
                    // console.log( "\tnotification response has error", error);
                    if(error) {console.error("error:", error); reject(error);} else {resolve();}
                });

                if (!this.cbCharacteristics.has(uuid)) {
                    const cb = (data: Buffer, isNotification: boolean) => {
                        if (isNotification) {
                            this.notifications.next({characteristic, data});
                        }
                    };
                    this.cbCharacteristics.set(uuid, cb);
                    characteristic.on("read", cb);
                }
                resolve();
            });
        }

        return Promise.reject( `no such characteristic "${uuid}" in BLE device "${this.name}"` );
    }

}
