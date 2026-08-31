import React from "react";
import { PhotoSlot } from "./PhotoSlot.jsx";
import { PriceBlock } from "./PriceBlock.jsx";
import { QuantityStepper } from "./QuantityStepper.jsx";

/** One row in the cart: photo, title, variant, quantity, price. */
export function CartLine({title,variant,price,image,qty=1,onQty,onRemove,style,...rest}){
  return (
    <div style={{display:"flex",gap:"var(--sp-4)",padding:"var(--sp-4) 0",alignItems:"flex-start",...style}} {...rest}>
      <PhotoSlot src={image} alt={title} ratio="1 / 1" style={{width:76,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:"var(--sp-2)"}}>
        <div style={{display:"flex",gap:"var(--sp-3)",alignItems:"flex-start"}}>
          <span style={{flex:1,fontSize:"var(--fs-body-sm)",fontWeight:"var(--fw-medium)",
            color:"var(--text-heading)",lineHeight:1.35}}>{title}</span>
          <button type="button" aria-label="Удалить" onClick={onRemove}
            style={{border:"none",background:"none",cursor:"pointer",color:"var(--text-muted)",
              fontSize:18,lineHeight:1,padding:"0 2px"}}>×</button>
        </div>
        {variant&&<span style={{fontSize:"var(--fs-caption)",color:"var(--text-muted)"}}>{variant}</span>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"var(--sp-2)"}}>
          <QuantityStepper value={qty} onChange={onQty} size="sm"/>
          <PriceBlock price={price*qty} size="sm"/>
        </div>
      </div>
    </div>
  );
}
