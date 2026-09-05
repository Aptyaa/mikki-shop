import React from "react";
import MARK_PNG from "../../assets/mascot-mark.png";   // transparent — for overlaps
import MARK_SVG from "../../assets/mascot.svg";        // full-colour vector, carries a light plate
import MARK_MONO from "../../assets/mascot-mark-mono.svg";
import HEAD from "../../assets/mascot-head.png";      // голова с шеей, без лап

const wordBase={fontFamily:"var(--font-wordmark)",fontWeight:400,lineHeight:1,
  letterSpacing:"0.01em",whiteSpace:"nowrap"};

const SIZES={sm:{mark:28,word:20},md:{mark:40,word:29},lg:{mark:64,word:44},xl:{mark:104,word:70}};

// Horizontal placement of the mascot over the wordmark, in ems of the word size.
// "Микки Шоп" is ~6.3em wide, so the first word's centre sits ~1.8em left of centre.
const OFFSETS={center:0,"first-word":-1.8,"word-gap":-0.35,"last-word":2.1};
const offsetEm=o=>typeof o==="number"?o:(OFFSETS[o]??0);

/** Wordmark bent over an arc, so the mascot can sit inside the curve. */
function ArcWord({word,width,color}){
  return (
    <svg viewBox="0 0 400 160" width={width} height={width*0.4} style={{overflow:"visible",display:"block"}}>
      <path id="ms-arc" d="M20 145 A 260 260 0 0 1 380 145" fill="none"/>
      <text fill={color} style={{...wordBase,fontSize:44}}>
        <textPath href="#ms-arc" startOffset="50%" textAnchor="middle">{word}</textPath>
      </text>
    </svg>
  );
}

/** Brand lockup: mascot + Cyrillic wordmark, in the arrangements the brand allows. */
export function Logo({variant="horizontal",size="md",tone="ink",word="Микки Шоп",
  mono=false,vector=false,offset="center",style,...rest}){
  const s=SIZES[size]||SIZES.md;
  const color=tone==="inverse"?"var(--text-inverse)":tone==="primary"?"var(--text-link)":"var(--text-heading)";
  const src=mono?MARK_MONO:vector?MARK_SVG:MARK_PNG;

  if(variant==="mark")
    return <img src={src} alt={word} width={s.mark} height={s.mark}
      style={{objectFit:"contain",...style}} {...rest}/>;

  // Только голова: мордочка целиком с шеей, срезанная дугой там, где начинается
  // корпус. Отдельный файл, а не кадр из знака: голову ставят под наклоном, а
  // прямоугольный кадр при повороте показывает шов по срезу.
  //
  // Ширина задаётся снаружи (`style`), высота считается сама: голова шире, чем
  // выше, и вписывать её в квадрат `SIZES.mark` значило бы врать о размере.
  //
  // Украшение, а не имя: `alt=""` и `aria-hidden` намеренно. Голову ставят
  // рядом с текстом, который и так называет раздел, — и «Микки Шоп», прочитанное
  // скринридером посреди заголовка, было бы лишним словом. Нужен знак с именем —
  // это `variant="mark"`; при необходимости `alt` перекрывается пропсом.
  // `maxWidth:none` — в `base.css` у всех картинок стоит `max-width:100%`, а
  // голову вешают украшением на узкий элемент (например, на одну букву
  // заголовка), и правило зажимало бы её до ширины родителя.
  if(variant==="head")
    return <img src={HEAD} alt="" aria-hidden="true"
      style={{display:"block",height:"auto",maxWidth:"none",...style}} {...rest}/>;

  if(variant==="wordmark")
    return <span style={{...wordBase,fontSize:s.word,color,...style}} {...rest}>{word}</span>;

  // Arc over a disc — the sketch's arrangement. Reads as a shop sign or a stamp.
  if(variant==="arc"){
    const disc=s.mark*1.9;
    return (
      <span role="img" aria-label={word}
        style={{display:"inline-flex",flexDirection:"column",alignItems:"center",
          gap:s.mark*-0.12,...style}} {...rest}>
        <ArcWord word={word} width={disc*1.28} color={color}/>
        <span style={{width:disc,height:disc,borderRadius:"var(--r-pill)",
          background:"var(--disc-butter)",display:"grid",placeItems:"center",overflow:"hidden"}}>
          <img src={src} alt="" width={disc*0.88} height={disc*0.88} style={{objectFit:"contain"}}/>
        </span>
      </span>
    );
  }

  // Mascot perched on the wordmark: only the front paws cross the cap line, the
  // body stays clear of the letters. Overlap is a fraction of the word size, so
  // the relationship holds at every scale.
  if(variant==="perched"){
    const dx=offsetEm(offset)*s.word;
    return (
      <span role="img" aria-label={word}
        style={{display:"inline-flex",flexDirection:"column",alignItems:"center",...style}} {...rest}>
        {/* The mark's bottom ~11% is the seated rear; tucking exactly that much
            behind the letters leaves the front paws sitting on the cap line. */}
        <img src={src} alt="" width={s.mark*1.5} height={s.mark*1.5}
          style={{objectFit:"contain",marginBottom:s.mark*-0.17,
            transform:dx?`translateX(${dx}px)`:undefined,position:"relative",zIndex:0}}/>
        <span style={{...wordBase,fontSize:s.word,color,position:"relative",zIndex:1}}>{word}</span>
      </span>
    );
  }

  // Mascot behind the wordmark, only his head and paws showing.
  if(variant==="peeking"){
    const dx=offsetEm(offset)*s.word;
    return (
      <span role="img" aria-label={word}
        style={{display:"inline-flex",flexDirection:"column",alignItems:"center",...style}} {...rest}>
        <span style={{height:s.mark*0.78,overflow:"hidden",display:"flex",
          alignItems:"flex-start",marginBottom:s.word*-0.10,
          transform:dx?`translateX(${dx}px)`:undefined}}>
          <img src={src} alt="" width={s.mark*1.4} height={s.mark*1.4} style={{objectFit:"contain"}}/>
        </span>
        <span style={{...wordBase,fontSize:s.word,color,position:"relative"}}>{word}</span>
      </span>
    );
  }

  const vertical=variant==="vertical";
  return (
    <span style={{display:"inline-flex",alignItems:"center",textDecoration:"none",
      flexDirection:vertical?"column":"row",gap:vertical?"var(--sp-3)":"var(--sp-4)",...style}} {...rest}>
      <img src={src} alt="" width={s.mark} height={s.mark} style={{objectFit:"contain"}}/>
      <span style={{...wordBase,fontSize:s.word,color}}>{word}</span>
    </span>
  );
}
