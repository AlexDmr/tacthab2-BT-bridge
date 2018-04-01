import * as defs from "./BrickMetaWear_defs";
import {MetaWear} from "./BrickMetaWear";
import {BehaviorSubject, Observable} from "@reactivex/rxjs";

const FSR_SCALE = [16.4, 32.8, 65.6, 131.2, 262.4];

const buffer_startGyroscope     = new Buffer(3);
buffer_startGyroscope[0] 	    = defs.modules.GYRO;
buffer_startGyroscope[1] 	    = defs.GyroBmi160Register.POWER_MODE;
buffer_startGyroscope[2] 	    = 0x1;

const buffer_stopGyroscope      = new Buffer(3);
buffer_stopGyroscope[0] 	    = defs.modules.GYRO;
buffer_stopGyroscope[1] 	    = defs.GyroBmi160Register.POWER_MODE;
buffer_stopGyroscope[2] 	    = 0x0;

const buffer_disableGyroscope 	= new Buffer(3);
buffer_disableGyroscope[0] 	    = defs.modules.GYRO;
buffer_disableGyroscope[1] 	    = defs.GyroBmi160Register.POWER_MODE;
buffer_disableGyroscope[2] 	    = 0;

const buffer_notifyGyroscope    = new Buffer(4);
buffer_notifyGyroscope[0]	    = defs.modules.GYRO;
buffer_notifyGyroscope[1]	    = defs.GyroBmi160Register.DATA_INTERRUPT_ENABLE;
buffer_notifyGyroscope[2]	    = 1;
buffer_notifyGyroscope[3]	    = 0;

const bufferSubscribe		    = new Buffer(3);
bufferSubscribe[0] 			    = defs.modules.GYRO;
bufferSubscribe[1] 			    = defs.GyroBmi160Register.DATA;
bufferSubscribe[2] 			    = 1;

const buffer_unnotifyGyroscope 	= new Buffer(4);
buffer_unnotifyGyroscope[0]	    = defs.modules.GYRO;
buffer_unnotifyGyroscope[1]	    = defs.GyroBmi160Register.DATA_INTERRUPT_ENABLE;
buffer_unnotifyGyroscope[2]	    = 0;
buffer_unnotifyGyroscope[3]	    = 1;

export type GYROMEASURE = {
    alpha: number;
    beta: number;
    gamma: number;
};

export class Gyroscope {
    private gyroMeasures = new BehaviorSubject<GYROMEASURE>(null);
    private gyroscope_scale = FSR_SCALE[ defs.MblMwGyroBmi160Range.MBL_MW_GYRO_BMI160_FSR_2000DPS ];


    constructor(private device: MetaWear) {
        device
            .getNotifications()
            .filter( N => N.module === defs.modules.GYRO)
            .filter( N => N.eventType === defs.GyroBmi160Register.DATA )
            .subscribe( ({data}) => {
                const alpha = data.readInt16LE(2) / this.gyroscope_scale;
                const beta  = data.readInt16LE(4) / this.gyroscope_scale;
                const gamma = data.readInt16LE(6) / this.gyroscope_scale;

                // console.log( "gyro", {alpha, beta, gamma} );
                this.gyroMeasures.next( {alpha, beta, gamma} );
            } );
    }

    getGyroMeasureObservable(): Observable<GYROMEASURE> {
        return this.gyroMeasures.asObservable();
    }

    getValue(): GYROMEASURE {
        return this.gyroMeasures.getValue();
    }

    start() {
        console.log( "BrickMetaWear::startGyroscope" );
        return this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_startGyroscope);
    }

    stop() {
        console.log( "BrickMetaWear::stopGyroscope" );
        return this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_stopGyroscope);
    }

    /*
    struct GyroBmi160Config
        uint8_t gyr_odr 	:4;
        uint8_t gyr_bwp 	:2;
        uint8_t 			:2;
        uint8_t gyr_range 	:3;
        uint8_t  			:5;
    */
    enable( config: {gyr_odr?: number, gyr_bwp?: number, gyr_range?: number} ) {
        config.gyr_odr  = config.gyr_odr 	|| defs.MblMwGyroBmi160Odr.MBL_MW_GYRO_BMI160_ODR_50HZ;
        config.gyr_bwp  = config.gyr_bwp 	|| 2;
        config.gyr_range= config.gyr_range  || defs.MblMwGyroBmi160Range.MBL_MW_GYRO_BMI160_FSR_2000DPS;

        this.gyroscope_scale = FSR_SCALE[ config.gyr_range ];

        console.log( "BrickMetaWear::enableGyroscope", this.gyroscope_scale, "/", config.gyr_range );
        const buffer = new Buffer(4); // Configure gyroscope
        buffer[0] = defs.modules.GYRO;
        buffer[1] = defs.GyroBmi160Register.CONFIG;
        buffer[2] = config.gyr_odr | (config.gyr_bwp << 4);
        buffer[3] = config.gyr_range;

        return 	this.device.writeCharacteristic(defs.COMMAND_UUID, buffer);
    }

    disable() {
        console.log( "BrickMetaWear::disableGyroscope" );
        return this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_disableGyroscope);
    }

    async notify() {
        console.log( "BrickMetaWear::notifyGyroscope" );
        await this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_notifyGyroscope );
        await this.start();
        return this.device.writeCharacteristic(defs.COMMAND_UUID, bufferSubscribe 		);
    }

    async unnotify() {
        console.log( "BrickMetaWear::unnotifyGyroscope" );
        await this.device.writeCharacteristic(defs.COMMAND_UUID, buffer_unnotifyGyroscope);
        this.gyroMeasures.next(undefined);
    }
}

/*
proto.setGyroscopePeriod = function(ms) {
	console.log( "BrickMetaWear::setGyroscopePeriod" );
	return Promise.resolve(ms);
}

//____________________________________________________________________________________________________
proto.readGyroscope 	= function() {
	console.log( "BrickMetaWear::readGyroscope" );
	return Promise.resolve({});
}

};
*/
