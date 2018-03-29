import * as express from "express";
import * as http from "http";                   // HTTP server
import * as bodyParser from "body-parser";      // Parse HTTP GET and POST variables
import * as socketIO from "socket.io";          // Websocket server
import * as noble from "noble";
import * as path from "path";
import {BLEDevice} from "./Devices/BLE";
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

const devices: BLEDevice[] = [];

const BT_state = {
    isOn: false,
    scanning: false,
    err: ""
};

/* Define REST API */
const pathClient = path.join(__dirname, "../htmlClient");
app.use("/htmlClient", express.static(pathClient));

app.get("/", (req, res) => {
    res.json( {state: BT_state, devices: devices.map(D => D.toJSON()) } );
});

app.post("/scanning", (req, res) => {
    const scanning = !!req.body["scanning"];
    if (scanning) {
        noble.startScanning( err => {
            if (err) {
                BT_state.err = err.toString();
            } else {
                updateBTState( {scanning: true} );
            }
        });
    } else {
        noble.stopScanning();
    }
});

function connectToDevice(req, res) {
	const uuid = req.query["uuid"] || req.body["uuid"];
	if (uuid) {
		const device = devices.find( D => D.getUUID() === uuid );
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
    ioHTTP.emit("bridgeState", {state: BT_state, devices: devices.map(D => D.toJSON()) } );
    // socket.on("disconnect", () => delSocketSubject.next(socket));
    socket.on("call", (call: CALL, cb) => {
        const {deviceId, method, arguments: Largs} = call;
        const device = devices.find( D => D.getUUID() === deviceId );
        if (!device) {
            Promise.resolve().then(() => device[method].apply(device, Largs)).then(
                res => cb({success: res}),
                err => cb({error: err, device, method, Largs})
            );
        } else {
            cb({error: `There is no brick identified by ${deviceId}`});
        }
    });
});

function updateBTState( update: {[key: string]: any}) {
    Object.assign(BT_state, update);
    ioHTTP.emit( "updateBTState", update );
}

noble.on('scanStart', () => {
    updateBTState( {scanning: true} );
});

noble.on('scanStop', () => {
    updateBTState( {scanning: false} );
});

noble.on('stateChange', state => {
    if(state === "poweredOn") {
        noble.startScanning();
    }
});

noble.on( 'discover', (peripheral: noble.Peripheral) => {
    console.log("Discover", peripheral.advertisement, peripheral.uuid);
    const device = instantiatePeripheral(peripheral);
    if (device) {
        devices.push(device);
        ioHTTP.emit("bridgeState", {state: BT_state, devices: devices.map(D => D.toJSON()) } );
        device.getStateObserver().subscribe(
            O => ioHTTP.emit("deviceUpdate", {uuid: device.getUUID(), O} )
        );
    }
});


type CALL = {
    deviceId: string;
    method: string;
    arguments: any[];
};
