import * as defs from "./BrickMetaWear_defs";
import {MetaWear} from "./BrickMetaWear";
import {BehaviorSubject, Observable} from "@reactivex/rxjs";

const FSR_SCALE = {
	0x3								: 16384,
	0x5								:  8192,
	0x8								:  4096,
	0xc								:  2048
};

const buffer_startAccelerometer	= new Buffer(3);
buffer_startAccelerometer[0] 	= defs.modules.ACCELEROMETER_OPCODE;
buffer_startAccelerometer[1] 	= defs.AccelerometerBmi160Register.POWER_MODE;
buffer_startAccelerometer[2] 	= 1;

const buffer_stopAccelerometer	= new Buffer(3);
buffer_stopAccelerometer[0] 	= defs.modules.ACCELEROMETER_OPCODE;
buffer_stopAccelerometer[1] 	= defs.AccelerometerBmi160Register.POWER_MODE;
buffer_stopAccelerometer[2] 	= 0;

const buffer_disableAccelerometer 	= new Buffer(3);
buffer_disableAccelerometer[0] 	= defs.modules.ACCELEROMETER_OPCODE;
buffer_disableAccelerometer[1] 	= defs.AccelerometerBmi160Register.POWER_MODE;
buffer_disableAccelerometer[2] 	= 0;

const buffer_notifyAccelerometer 		= new Buffer(4);
buffer_notifyAccelerometer[0]	= defs.modules.ACCELEROMETER_OPCODE;
buffer_notifyAccelerometer[1]	= defs.AccelerometerBmi160Register.DATA_INTERRUPT_ENABLE;
buffer_notifyAccelerometer[2]	= 0x1;
buffer_notifyAccelerometer[3]	= 0x0;

const buffer_subscribeAcc				= new Buffer(3);
buffer_subscribeAcc[0] 			= defs.modules.ACCELEROMETER_OPCODE;
buffer_subscribeAcc[1] 			= defs.AccelerometerBmi160Register.DATA_INTERRUPT;
buffer_subscribeAcc[2] 			= 1;

const buffer_unnotifyAccelerometer 	= new Buffer(4);
buffer_unnotifyAccelerometer[0]	= defs.modules.ACCELEROMETER_OPCODE;
buffer_unnotifyAccelerometer[1]	= defs.AccelerometerBmi160Register.DATA_INTERRUPT_ENABLE;
buffer_unnotifyAccelerometer[2]	= 0x0;
buffer_unnotifyAccelerometer[3]	= 0x1;

export type ACCELERATION = {
    x: number;
    y: number;
    z: number;
}

export class Accelerometer {
    private accelerometer_scale = 2048;
    private accelerations = new BehaviorSubject<ACCELERATION>(null);

    constructor(private device: MetaWear) {
        device
            .getNotifications()
            .filter( N => N.module === defs.modules.ACCELEROMETER_OPCODE)
            .filter( N => N.eventType === defs.AccelerometerBmi160Register.DATA_INTERRUPT )
            .subscribe( ({data}) => {
                const x = data.readInt16LE(2) / this.accelerometer_scale;
                const y = data.readInt16LE(4) / this.accelerometer_scale;
                const z = data.readInt16LE(6) / this.accelerometer_scale;

                // console.log( "accelerometerChange", {x:x, y:y, z:z} );
                this.accelerations.next( {x:x, y:y, z:z} );
            } );
    }

    getAccelerationObservable(): Observable<ACCELERATION> {
        return this.accelerations.asObservable();
    }

    getValue(): ACCELERATION {
        return this.accelerations.getValue();
    }

    start() {
        console.log( "BrickMetaWear::startAccelerometer" );
        return this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_startAccelerometer);
    }

    stop() {
        console.log( "BrickMetaWear::startAccelerometer" );
        return this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_stopAccelerometer);
    }

    /*
    struct AccBmi160Config
        uint8_t acc_odr:4;		// 4 bits for output data rate
        uint8_t acc_bwp:3; 		// 3 bits for
        uint8_t acc_us:1; 		// 1 bit  for
        uint8_t acc_range:4;	// 4 bits for range
        uint8_t :4;
    */
    enable( config: {acc_odr?: number, acc_bwp?: number, acc_us?: number, acc_range?: number} ) {
        config.acc_odr   = config.acc_odr 	|| defs.MblMwAccBmi160Odr.MBL_MW_ACC_BMI160_ODR_12_5HZ;
        config.acc_bwp   = config.acc_bwp 	|| 2;
        config.acc_us    = config.acc_us    || 0;
        config.acc_range = config.acc_range || defs.MblMwAccBmi160Range.MBL_MW_ACC_BMI160_FSR_2G;

        config.acc_odr 	= Math.min	( defs.MblMwAccBmi160Odr.MBL_MW_ACC_BMI160_ODR_100HZ
            , Math.max	( config.acc_odr
                , defs.MblMwAccBmi160Odr.MBL_MW_ACC_BMI160_ODR_12_5HZ
            )
        );

        console.log( config.acc_range, " =>", FSR_SCALE[ config.acc_range ] );
        this.accelerometer_scale = FSR_SCALE[ config.acc_range ];

        console.log( "BrickMetaWear::enableAccelerometer" );
        const buffer = new Buffer(4); // Configure accelerometer?
        buffer[0] = defs.modules.ACCELEROMETER_OPCODE;
        buffer[1] = defs.AccelerometerBmi160Register.DATA_CONFIG;
        buffer[2] = config.acc_odr | (config.acc_bwp << 4) | (config.acc_us << 7)
        buffer[3] = config.acc_range;

        return 	this.device.writeCharacteristic(defs.COMMAND_UUID, buffer);
    }

    disable() {
        console.log( "BrickMetaWear::disableAccelerometer" );
        return this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_disableAccelerometer);
    }

    async notify() {
        console.log( "BrickMetaWear::notifyAccelerometer" );
        await this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_notifyAccelerometer);
        await this.start();
        return this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_subscribeAcc);
    }

    async unnotify() {
        console.log( "BrickMetaWear::unnotifyAccelerometer" );
        await this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_unnotifyAccelerometer);
        this.accelerations.next(undefined);
    }

}

/*
//____________________________________________________________________________________________________
proto.setAccelerometerPeriod = function(ms) {
	console.log( "BrickMetaWear::setAccelerometerPeriod" );
	return Promise.resolve(ms);
}

//____________________________________________________________________________________________________
proto.readAccelerometer 	= function() {
	console.log( "BrickMetaWear::readAccelerometer" );
	return Promise.resolve({});
}
};
*/
