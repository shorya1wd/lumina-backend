import mongoose,{Schema} from "mongoose"
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const watchHistorySchema=new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:false,
    },
    guestIdentifier:{
        type:String,
        required:false,
    },
    video:{
        type:Schema.Types.ObjectId,
        ref:"Video",
        required:true
    }
},
{
    timestamps:true
}
)

watchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

watchHistorySchema.plugin(mongooseAggregatePaginate);

export const WatchHistory=mongoose.model("WatchHistory",watchHistorySchema)