const socket = io();

const mapDevices = new Map();
const mapDeviceSections = new Map();
const BTState = document.querySelector("BTState");

socket.on("bridgeState", bridgeState => {
    // console.log("bridgeState:", bridgeState);
    BTState.textContent = JSON.stringify( bridgeState.state );
    BTState.devices.forEach( D => {
        BTState.set( D.uuid, D );
        updateDeviceSection( D.uuid );
    });
});

socket.on("deviceUpdate", deviceUpdate => {
    const device = mapDevices.get( deviceUpdate.uuid );
    // console.log("deviceUpdate:", deviceUpdate);
    for(let key in deviceUpdate.update) {
        const val = deviceUpdate.update[key];
        device.state[key] = val;
    }
    updateDeviceSection( deviceUpdate.uuid );
});

function updateDeviceSection(uuid) {
    const D = mapDevices.get(uuid);
    let div = mapDeviceSections.get(uuid);
    if (!div) {
        div = document.createElement("div");
        div.classList.add("device");
        document.appendChild(div);
    }
    let str = "";
    for(let key in D.state) {
        const val = JSON.stringify( D.state[key] );
        str += `${key}: ${val}<br/>`
    }
    div.innerHTML = str;
}
