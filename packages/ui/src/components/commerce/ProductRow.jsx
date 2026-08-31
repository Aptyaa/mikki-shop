import React from "react";
import { PhotoSlot } from "./PhotoSlot";
import { PriceBlock } from "./PriceBlock";
import { Dot } from "../core/Dot";

/** One product as a list row: print, name, meta, price. The catalogue's primary layout.
 *  Rows separate by a hairline rule — never by a card. */
export function ProductRow({title,price,was,image,meta,marked=false,soldOut=false,
  favourite=false,onFavourite,onClick,last=false,style,...rest}){
  return (
    <div onClick={onClick}
      style={{display:"flex",gap:"var(--sp-5)",alignItems:"center",
        padding:"var(--sp-5) 0",cursor:"pointer",
        borderBottom:last?"none":"1px solid var(--border-subtle)",...style}} {...rest}>
      <PhotoSlot src={image} alt={title} ratio="4 / 5" label=""
        style={{width:66,flexShrink:0,opacity:soldOut?.5:1}}/>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:"var(--sp-2)"}}>
        <span style={{fontFamily:"var(--font-body)",fontWeight:"var(--fw-medium)",
          fontSize:"var(--fs-body)",lineHeight:1.35,color:"var(--text-heading)"}}>{title}</span>
        {meta&&<span style={{fontSize:"var(--fs-caption)",color:"var(--text-muted)",lineHeight:1.4}}>
          {marked&&<Dot/>}{meta}</span>}
      </div>
      <PriceBlock price={price} was={was} stacked align="right"/>
      {onFavourite&&
        <button type="button" aria-label="В избранное"
          onClick={(e)=>{e.stopPropagation();onFavourite();}}
          style={{border:"none",background:"none",cursor:"pointer",padding:"0 0 0 var(--sp-2)",
            fontSize:15,lineHeight:1,color:favourite?"var(--accent-fav)":"var(--border-strong)"}}>
          {favourite?"♥":"♡"}
        </button>}
    </div>
  );
}
