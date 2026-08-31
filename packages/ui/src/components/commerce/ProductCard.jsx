import React from "react";
import { PhotoSlot } from "./PhotoSlot";
import { PriceBlock } from "./PriceBlock";
import { Tag } from "../core/Tag";

/** Grid tile for one product. No box: the photograph is the tile.
 *  Two per row at 390pt, separated by --grid-gap / --grid-gap-row. */
export function ProductCard({title,price,was,image,tag,tagTone="sale",sizes,favourite=false,
  onFavourite,onClick,soldOut=false,style,...rest}){
  const [h,setH]=React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:"flex",flexDirection:"column",gap:"var(--sp-4)",cursor:"pointer",...style}} {...rest}>
      <div style={{position:"relative"}}>
        <PhotoSlot src={image} alt={title} ratio="4 / 5"
          style={{opacity:soldOut?.55:1,
            filter:h?"brightness(.97)":"none",
            transition:"filter var(--dur-base) var(--ease-out)"}}/>
        {tag&&<span style={{position:"absolute",top:10,left:10}}><Tag tone={tagTone}>{tag}</Tag></span>}
        {soldOut&&<span style={{position:"absolute",inset:0,display:"grid",placeItems:"center"}}>
          <Tag tone="neutral">нет в наличии</Tag></span>}
        <button type="button" aria-label="В избранное"
          onClick={(e)=>{e.stopPropagation();onFavourite&&onFavourite();}}
          style={{position:"absolute",top:8,right:8,width:32,height:32,borderRadius:"var(--r-pill)",
            border:"none",background:"var(--bg-elevated)",
            display:"grid",placeItems:"center",cursor:"pointer",
            color:favourite?"var(--accent-fav)":"var(--text-muted)",fontSize:15,lineHeight:1}}>
          {favourite?"♥":"♡"}
        </button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"var(--sp-2)"}}>
        <span style={{fontFamily:"var(--font-body)",fontWeight:"var(--fw-regular)",fontSize:"var(--fs-body-sm)",
          lineHeight:1.4,color:"var(--text-heading)",display:"-webkit-box",WebkitLineClamp:2,
          WebkitBoxOrient:"vertical",overflow:"hidden",minHeight:"2.8em"}}>{title}</span>
        <PriceBlock price={price} was={was}/>
        {sizes&&<span style={{fontSize:"var(--fs-micro)",letterSpacing:"var(--ls-micro)",
          textTransform:"uppercase",color:"var(--text-muted)"}}>{sizes}</span>}
      </div>
    </div>
  );
}
