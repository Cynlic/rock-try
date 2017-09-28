#![feature(plugin, decl_macro)]
#![feature(proc_macro)]
#![plugin(rocket_codegen)]

extern crate rocket;
extern crate maud;
use maud::*;
use rocket::*;
use rocket::response::NamedFile;
use std::path::Path;
use rocket::response::status::NotFound;


#[get("/<name>/<age>")]
fn hello(name: String, age: u8) -> String {
    format!("Hello, {} year old named {}!", age, name)
}

#[get("/")]
fn index() -> PreEscaped<String> {
    html!{
        canvas id="glCanvas" width="640" height="480" {
        }
        (PreEscaped("
<script src=\"gl-texs.js\"></script>
<script src=\"gl-video.js\"></script>
<script src=\"gl-matrix.js\"></script>
<script src=\"new.js\"></script>"))
    }
}

#[get("/new.js")]
fn js()-> Result<NamedFile, NotFound<String>>{
    NamedFile::open("new.js").map_err(|_| NotFound(format!("Bad Path!")))
}

#[get("/gl-matrix.js")]
fn gl_matrix()-> Result<NamedFile, NotFound<String>>{
    NamedFile::open("gl-matrix.js").map_err(|_| NotFound(format!("Bad Path!")))
}

#[get("/<file>")]
fn include(file: String)-> Result<NamedFile, NotFound<String>>{
    NamedFile::open(file).map_err(|_| NotFound(format!("Bad Path!")))
}

fn main() {
    //rocket::ignite().mount("/hello", routes![hello]).launch();
    rocket::ignite().mount("/", routes![index, include]).launch();
}
