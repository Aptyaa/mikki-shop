Bottom tabs. Max 5, labels one word.

```jsx
<TabBar value={tab} onChange={setTab} items={[
  {key:"home",label:"Каталог",icon:<Icon name="home"/>},
  {key:"cart",label:"Корзина",icon:<Icon name="shopping-bag"/>,badge:3}]}/>
```

On VK Mini Apps set `reserveMainButton={false}` — VK has no MainButton, so the bar sits on the safe-area inset alone.
