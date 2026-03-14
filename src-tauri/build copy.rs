fn main() {
    // std::env::set_var("FAISS_SYS_NO_BUILD", "1");
    
    // println!("cargo:rustc-link-search=native=F:/React/project/Chatable/src-tauri/lib");

    // println!("cargo:rustc-link-lib=openblas");
    // println!("cargo:rustc-link-lib=faiss");
    // println!("cargo:rustc-link-lib=faiss_c");

    tauri_build::build();
}
