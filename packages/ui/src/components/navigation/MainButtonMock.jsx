import React from "react";
import { PawSpinner } from "../feedback/PawSpinner.jsx";

/** Visual stand-in for Telegram's native MainButton. Mockups only — in production call
 *  window.Telegram.WebApp.MainButton.setParams({text, color}) instead of rendering this. */
export function MainButtonMock({text="ОФОРМИТЬ ЗАКАЗ",progress=false,disabled=false,onClick,style,...rest}){
  return (
    <div style={{position:"sticky",bottom:0,padding:"0",zIndex:50,...style}}>
      <button type="button" onClick={onClick} disabled={disabled||progress}
        style={{width:"100%",height:"var(--tg-mainbutton-h)",border:"none",
          background:disabled?"var(--action-disabled)":"var(--action-primary)",
          color:disabled?"var(--text-muted)":"var(--text-on-primary)",
          fontFamily:"var(--font-body)",fontWeight:"var(--fw-semibold)",fontSize:"15px",
          letterSpacing:"0.02em",cursor:disabled?"default":"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:"var(--sp-3)"}} {...rest}>
        {progress&&<PawSpinner size={17}/>}
        {text}
      </button>
    </div>
  );
}
