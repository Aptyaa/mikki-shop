import React from "react";
/** Colourway picker — swatch discs with a selected ring. */
export function ColorPicker({colors=[],value,onChange,style,...rest}){
  return (
    <div style={{display:"flex",gap:"var(--sp-4)",alignItems:"center",...style}} {...rest}>
      {colors.map(c=>{
        const on=value===c.name;
        return (
          <button key={c.name} type="button" title={c.name} aria-label={c.name} onClick={()=>onChange&&onChange(c.name)}
            style={{width:36,height:36,borderRadius:"50%",cursor:"pointer",padding:0,
              background:c.hex,border:"1.5px solid var(--border-strong)",
              boxShadow:on?"0 0 0 2px var(--surface-card), 0 0 0 4px var(--action-primary)":"none",
              transition:"box-shadow var(--dur-fast) var(--ease-out)"}}/>
        );
      })}
    </div>
  );
}
