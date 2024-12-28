export function loadImage(src) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.src = src;
        let fulfill = ()=>{
            img.removeEventListener('load', fulfill);
            img.removeEventListener('error', fulfill);
            if (img.naturalWidth) resolve(img);
            else reject();
        };
        if (img.naturalWidth) {
            resolve(img);
        } else if (img.complete) {
            reject(img);
        } else {
            img.addEventListener('load', fulfill);
            img.addEventListener('error', fulfill);
        }
    });
}
