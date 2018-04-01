import * as express from "express";
import * as http from "http";                   // HTTP server
import * as bodyParser from "body-parser";      // Parse HTTP GET and POST variables
import * as socketIO from "socket.io";          // Websocket server
import * as noble from "noble";
import * as path from "path";
import {getDevices} from "./Devices/BLE";
import {instantiatePeripheral} from "./Devices/Instantiators";
import "./Devices/MetaWear/BrickMetaWear";

export const app: express.Application = express();

// HTTP
const serverHTTP = http.createServer(app);
const portHTTP = process.env.PORT || 8880;
serverHTTP.listen(portHTTP, () => {
    console.log(`HTTP server running on port ${portHTTP}`);
});

app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({extended: true}));

const BT_state = {
    isOn: false,
    scanning: false,
    err: ""
};

/* Define REST API */
const pathClient = path.join(__dirname, "../htmlClient");
app.use("/htmlClient", express.static(pathClient));

app.get("/", (req, res) => {
    res.json( {state: BT_state, devices: getDevices().map(D => D.toJSON()) } );
});

app.post("/scanning", ScanBLE);
app.get ("/scanning", ScanBLE);
function ScanBLE(req, res) {
    const scanning = !!( req.body["on"] || req.query["on"] );
    if (scanning) {
        noble.startScanning([], true, err => {
            if (err) {
                BT_state.err = err.toString();
                res.end( `ERROR: ${BT_state.err}` );
            } else {
                updateBTState( {scanning: true} );
                res.end("STARTED");
            }
        });
    } else {
        noble.stopScanning();
        res.end("STOPPED");
    }
}

function connectToDevice(req, res) {
	const uuid = req.query["uuid"] || req.body["uuid"];
	if (uuid) {
		const device = getDevices().find( D => D.getUUID() === uuid );
		if (device) {
			device.connect().then(
				() => res.json( device.toJSON() ),
				err => res.status(500, err)
			);
		} else {
			res.status(400).end(`There is no device having uuid ${uuid}`);
		}
	} else {
		res.status(400).end("a uuid should be specified");
	}
}

app.get ("/connect", connectToDevice);
app.post("/connect", connectToDevice);


/* Define Socket.IO API */
const ioHTTP  = socketIO(serverHTTP );
ioHTTP.on("connection", socket => {
    emitBTState();
    // socket.on("disconnect", () => delSocketSubject.next(socket));
    socket.on("call", (call: CALL, cb) => {
        const {deviceId, method, arguments: Largs} = call;
        const device = getDevices().find( D => D.getUUID() === deviceId );
        if (device) {
            Promise.resolve().then(() => device[method].apply(device, Largs)).then(
                res => cb ? cb({success: res}) : undefined,
                err => cb ? cb({error: err, device, method, Largs}) : undefined
            );
        } else {
			console.error( `There is no brick identified by ${deviceId}` );
			getDevices().forEach( D => console.error( `\t* ${D.getUUID()}` ) );
            if (cb) {
				cb({error: `There is no brick identified by ${deviceId}`});
			}
        }
    });
});

function updateBTState( update: {[key: string]: any}) {
    Object.assign(BT_state, update);
    // ioHTTP.emit( "updateBTState", update );
    emitBTState();
}

noble.on('scanStart', () => {
    updateBTState( {scanning: true} );
});

noble.on('scanStop', () => {
    updateBTState( {scanning: false} );
});

noble.on('stateChange', state => {
    if(state === "poweredOn") {
        noble.startScanning([], true);
    }
});

noble.on( 'discover', (peripheral: noble.Peripheral) => {
    // console.log("Discover", peripheral.advertisement, peripheral.uuid);
    const device = instantiatePeripheral(peripheral);
    if (device) {
        emitBTState();
        device.getStateObserver().subscribe(
            update => ioHTTP.emit("deviceStateUpdate", {uuid: device.getUUID(), update} )
        );
        device.getIsConnected().obs.subscribe(
            isConnected => ioHTTP.emit("deviceConnectedUpdate", {uuid: device.getUUID(), isConnected} )
        );
    }
});

function emitBTState() {
    ioHTTP.emit("bridgeState", {state: BT_state, devices: getDevices().map(D => D.toJSON()) } );
}

type CALL = {
    deviceId: string;
    method: string;
    arguments: any[];
};
