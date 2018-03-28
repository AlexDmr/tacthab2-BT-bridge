import {BLEDevice, CHARACTERISTIC_NOTIFICATION} from "../BLE";
import * as noble from "noble";
import * as defs from "./BrickMetaWear_defs";
import {BehaviorSubject, Observable} from "@reactivex/rxjs";
import {registerBleInstanciator} from "../Instantiators";
import {Accelerometer} from "./Accelerometer";
import {Gyroscope} from "./Gyroscope";

const bufferSubscribeSwitch = new Buffer(3);
bufferSubscribeSwitch[0] = 1;
bufferSubscribeSwitch[1] = 1;
bufferSubscribeSwitch[2] = 1;

export type METAWEAR_NOTIFICATION = CHARACTERISTIC_NOTIFICATION & {module: number, eventType: number};
//____________________________________________________________________________________________________
// 
//____________________________________________________________________________________________________
export class MetaWear extends BLEDevice {
    protected metaWearNotifications: Observable<METAWEAR_NOTIFICATION>;
    protected buttonState = new BehaviorSubject<boolean>(undefined);
    protected stateObserver: Observable<any>;
    protected accelerometer: Accelerometer;
    protected gyroscope: Gyroscope;

    constructor(peripheral: noble.Peripheral) {
        super(peripheral);

        this.metaWearNotifications = super.getNotifications().map( N => ({
            ...N,
            module: N.data.readUInt8(0),
            eventType: N.data.readUInt8(1)
        }) );

        this.metaWearNotifications
            .filter(N => N.module === defs.modules.SWITCH && N.eventType === defs.SwitchRegister.STATE)
            .subscribe(N => {
                const state = N.data.readUInt8(2) === 1;
                this.buttonState.next(state);
            });

        this.accelerometer  = new Accelerometer(this);
        this.gyroscope      = new Gyroscope(this);

        this.stateObserver = Observable.combineLatest( [
            this.buttonState,
            this.accelerometer.getAccelerationObservable(),
            this.gyroscope.getGyroMeasureObservable()
        ] );
    }

    getAccelerometer(): Accelerometer {
        return this.accelerometer;
    }

    getNotifications(): Observable<METAWEAR_NOTIFICATION> {
        return this.metaWearNotifications;
    }

    getStateObserver(): Observable<any> {
        return this.stateObserver;
    }

    async connect() {
        await super.connect();
        await this.notifyCharacteristic(defs.NOTIFY_UUID, true);
        return this.writeCharacteristic(defs.COMMAND_UUID, bufferSubscribeSwitch);
    }

    async disconnect() {
        // clearInterval( this.temperature.timer );
        await this.notifyCharacteristic(defs.NOTIFY_UUID, false);
        return super.disconnect();
    }

}

registerBleInstanciator( (peripheral: noble.Peripheral) => {
    const localName: string = peripheral.advertisement ? peripheral.advertisement.localName : "";
    // console.log( "Is", localName, "a metawear device ?" );
    if (localName && localName.toLocaleLowerCase() === 'metawear') {
		console.log( "CREATE a METAWEAR !" );
        const mw = new MetaWear(peripheral);
        mw.getStateObserver().subscribe( state => console.log(state) );
        mw.connect().then(
            () => {
                mw.getAccelerometer().notify();
            },
            err => console.error("error connecting to metawear device", err)
        );
        return mw;
    } else {
        return undefined;
    }
});
