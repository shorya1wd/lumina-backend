import mongoose,{Schema} from "mongoose"
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const playlistSchema=new Schema({
    owner:{
        type:Schema.Types.ObjectId,
        ref:"User"
    },
    videos:[{
        type:Schema.Types.ObjectId,
        ref:"Video"
    }],
    name:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        trim:true
    },
    isPrivate:{
        type:Boolean,
        default:true
    }   
},
{
    timestamps:true
} 
)

playlistSchema.plugin(mongooseAggregatePaginate);

export const Playlist=mongoose.model("Playlist",playlistSchema)