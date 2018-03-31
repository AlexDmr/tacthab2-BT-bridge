const socket = io();

const mapDevices = new Map();
const mapDeviceSections = new Map();
const BTState = document.querySelector("#BTState");

socket.on("bridgeState", bridgeState => {
    console.log("bridgeState:", bridgeState);
    BTState.textContent = JSON.stringify( bridgeState.state );
    bridgeState.devices.forEach( D => {
        mapDevices.set( D.uuid, D );
        updateDeviceSection( D.uuid );
    });
});

socket.on("deviceConnectedUpdate", deviceUpdate => {
    const device = mapDevices.get( deviceUpdate.uuid );
    device.isConnected = deviceUpdate.isConnected;
    updateDeviceSection( deviceUpdate.uuid );
});

socket.on("deviceStateUpdate", deviceUpdate => {
    const device = mapDevices.get( deviceUpdate.uuid );
    // console.log("deviceUpdate:", deviceUpdate);
    /*for(let key in deviceUpdate.update) {
        const val = deviceUpdate.update[key];
        device.state[key] = val;
    }*/
    device.state = {...device.state, ...update};
    updateDeviceSection( deviceUpdate.uuid );
});

function updateDeviceSection(uuid) {
	console.log("update device", uuid);
    const D = mapDevices.get(uuid);
    let div = mapDeviceSections.get(uuid);
    if (!div) {
        div = document.createElement("div");
        div.classList.add("device");
        document.body.appendChild(div);
        mapDeviceSections.set(uuid, div);
    }
    let str = `Device ${uuid}<br/>
				isConnected: ${D.isConnected}
				<button class="connect">Toggle connection</button>
				<br/>
				`;
    for(let key in D.state) {
        const val = JSON.stringify( D.state[key] );
        str += `${key}: ${val}<br/>`
    }
    div.innerHTML = str;
    
    // Button toggle connect
    const btConnect = div.querySelector("button.connect");
    btConnect.onclick = () => {
		socket.emit("call", {
			deviceId: uuid,
			method: D.isConnected ? "disconnect" : "connect",
			arguments: []
		});
	}
}
