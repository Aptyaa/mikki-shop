import React from "react";
/** Star rating with optional review count. */
export function RatingStars({value=0,count,size=14,showValue=true,style,...rest}){
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:"var(--sp-2)",
      fontSize:"var(--fs-caption)",color:"var(--text-muted)",...style}} {...rest}>
      <span style={{display:"inline-flex",gap:1,color:"var(--rating-star)",fontSize:size,lineHeight:1}}>
        {[0,1,2,3,4].map(i=><span key={i} style={{opacity:i<Math.round(value)?1:.25}}>★</span>)}
      </span>
      {showValue&&<strong style={{color:"var(--text-heading)",fontWeight:"var(--fw-semibold)"}}>{value.toFixed(1)}</strong>}
      {count!=null&&<span>({count})</span>}
    </span>
  );
}
