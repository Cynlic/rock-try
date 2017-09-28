main();

function main(){
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");

    const canvas = document.querySelector("#glCanvas");
    // Initialize the GL context
    const gl = canvas.getContext("webgl");
}
