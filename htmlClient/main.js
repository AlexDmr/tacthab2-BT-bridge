const socket = io();

socket.on("bridgeState", bridgeState => {
    console.log("bridgeState:", bridgeState);
});

socket.on("deviceUpdate", deviceUpdate => {
    console.log("deviceUpdate:", deviceUpdate);
});
