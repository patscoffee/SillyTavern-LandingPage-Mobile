export const canvasWithContext = (options = {})=>{
    const canvas = document.createElement('canvas');
    for (const [k,v] of Object.entries(options)) {
        canvas[k] = v;
    }
    const context = canvas.getContext('2d');
    return { canvas, context };
};
