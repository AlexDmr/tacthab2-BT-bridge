import {BLEDevice, CHARACTERISTIC_NOTIFICATION} from "../BLE";
import * as noble from "noble";
import * as defs from "./BrickMetaWear_defs";
import {BehaviorSubject, Observable} from "@reactivex/rxjs";
import {registerBleInstanciator} from "../Instantiators";

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

    constructor(peripheral: noble.Peripheral) {
        super(peripheral);

        this.metaWearNotifications = this.getNotifications().map( N => ({
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

        this.stateObserver = Observable.combineLatest( [this.buttonState] );
    }

    getNotifications(): Observable<CHARACTERISTIC_NOTIFICATION> {
        return this.metaWearNotifications;
    }

    getStateObserver(): Observable<any> {
        return this.stateObserver;
    }

}

registerBleInstanciator( (peripheral: noble.Peripheral) => {
    const localName: string = peripheral.advertisement ? peripheral.advertisement.localName : "";
    if (localName && localName.toLocaleLowerCase() === 'metawear') {
        return new MetaWear(peripheral);
    } else {
        return undefined;
    }
});

/*
BrickMetaWear.is 	= function(peripheral) {
  var localName = peripheral.advertisement?peripheral.advertisement.localName:"";
  localName = localName || "";
  return localName.toLocaleLowerCase() === 'metawear';
}

BrickMetaWear.prototype = Object.create(BrickBLE.prototype); // new Brick(); BrickUPnP.prototype.unreference();
BrickMetaWear.prototype.constructor	= BrickMetaWear;
BrickMetaWear.prototype.getTypeName	= function() {return "BrickMetaWear";}
BrickMetaWear.prototype.getTypes	= function() {var L = BrickBLE.prototype.getTypes(); 
												  L.push(BrickMetaWear.prototype.getTypeName()); 
												  return L;}
BrickMetaWear.prototype.registerType('BrickMetaWear', BrickMetaWear.prototype);

accelerometer 	( BrickMetaWear.prototype );
magnetometer	( BrickMetaWear.prototype );
temperature		( BrickMetaWear.prototype );
luminometer		( BrickMetaWear.prototype );
gyroscope 		( BrickMetaWear.prototype );
barometer 		( BrickMetaWear.prototype );
LED 			( BrickMetaWear.prototype );
//____________________________________________________________________________________________________
// Connection
//____________________________________________________________________________________________________
BrickMetaWear.prototype.connect 		= function() {
	var brick = this;
	return BrickBLE.prototype.connect.apply(this, []).then( function() {
		brick.notifyCharacteristic(defs.NOTIFY_UUID, true);
	}).then( function() {
		brick.writeCharacteristic(defs.COMMAND_UUID, bufferSubscribeSwitch);
	})
}

BrickMetaWear.prototype.disconnect	= function() {
	clearInterval( this.temperature.timer );
	return this.notifyCharacteristic(defs.NOTIFY_UUID, false).then( function() {
				BrickBLE.prototype.disconnect.apply(this, [])
			});
}

//____________________________________________________________________________________________________
// Exports
//____________________________________________________________________________________________________
module.exports = BrickMetaWear;

*/