import multer from "multer";

const storage=multer.diskStorage({
    destination:function(req,file,cb){
        cb(null,'./public/temp')
    },
    filename:function(req,file,cb){
        const uniqueSuffix=Date.now() + '-' + Math.round(Math.random()* 1E9)
        cb(null,file.originalname+'-'+uniqueSuffix)
    }
})

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
        cb(null, true);
    } else {
        cb(new Error("Unsupported file type! Please upload only images or videos."), false);
    }
};

export const upload=multer(
    {
        storage,
        fileFilter
    }
)


/*
import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/temp");
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.originalname + '-' + uniqueSuffix);
    }
});

// THE UPGRADE: Security Filter
const fileFilter = (req, file, cb) => {
    // If the file is an image or a video, accept it!
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
        cb(null, true);
    } else {
        // If it is anything else, reject it with an error
        cb(new Error("Unsupported file type! Please upload only images or videos."), false);
    }
};

export const upload = multer({ 
    storage, 
    fileFilter // Add the filter to the multer config
});
*/