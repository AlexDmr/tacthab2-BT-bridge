import * as express from "express";
import * as http from "http";                   // HTTP server
import * as bodyParser from "body-parser";      // Parse HTTP GET and POST variables
import * as socketIO from "socket.io";          // Websocket server
import * as noble from "noble";
import {BLEDevice} from "./Devices/BLE";
import {instantiatePeripheral} from "./Devices/Instantiators";

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

/* Define Socket.IO API */
const ioHTTP  = socketIO(serverHTTP );

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
    const device = instantiatePeripheral(peripheral);
    if (device) {
        devices.push(device);
    }
});
