window.AABHA_DEFAULT_CATEGORIES = ['Silk','Cotton','Festive','Everyday'];
window.AABHA_INITIAL_COLLECTIONS = ['Kanchivaram'];
window.loadAabhaCategories = function () {
  let saved=[];
  let productCategories=[];
  let hasSavedCategories=false;
  try {
    const stored=localStorage.getItem('aabhaCategories');
    hasSavedCategories=stored!==null;
    const value=JSON.parse(stored||'[]');
    if(Array.isArray(value))saved=value;
  } catch {}
  try {
    const value=JSON.parse(localStorage.getItem('aabhaProducts')||'[]');
    if(Array.isArray(value))productCategories=value.map(product=>product.category);
  } catch {}
  const baseCategories=hasSavedCategories?saved:[...window.AABHA_DEFAULT_CATEGORIES,...window.AABHA_INITIAL_COLLECTIONS,...productCategories];
  const names=[...baseCategories,...productCategories]
    .filter(value=>typeof value==='string')
    .map(value=>value.trim().replace(/\s+/g,' '))
    .filter(value=>value.length>0&&value.length<=40);
  return [...new Map(names.map(name=>[name.toLocaleLowerCase(),name])).values()];
};

window.AABHA_DEFAULT_PRODUCTS = [
  {id:1,name:'Gulabi Kanchipuram Silk',category:'Silk',price:2899,badge:'BESTSELLER',detail:'Kanchipuram silk · Zari border',description:'A thoughtfully chosen silk saree with a graceful drape and a story woven into every detail. Includes an unstitched blouse piece.',image:'https://pochampallysarees.com/cdn/shop/files/unnamed_a3b0bfe0-0616-4df0-92bc-a566a16d4fb4.jpg?v=1773934466&width=800',alt:'Orange and magenta Kanchipuram silk saree with gold zari',colors:['#c64c36','#bd4b80','#d7a345']},
  {id:2,name:'Rani Banarasi Silk',category:'Festive',price:3499,badge:'FESTIVE PICK',detail:'Banarasi silk · Gold motifs',description:'A thoughtfully chosen festive saree with a graceful drape and a story woven into every detail. Includes an unstitched blouse piece.',image:'https://images.unsplash.com/photo-1726981448126-c7fc9237cdb5?auto=format&fit=crop&w=850&q=85',alt:'Woman wearing a red and gold traditional saree',colors:['#963d38','#d1a24a']},
  {id:3,name:'Mehndi Gadwal Silk',category:'Silk',price:2799,badge:'HANDLOOM',detail:'Gadwal silk · Temple border',description:'A thoughtfully chosen silk saree with a graceful drape and a story woven into every detail. Includes an unstitched blouse piece.',image:'https://cdn.shopify.com/s/files/1/0627/8807/5715/files/Gadwal-Handloom-Pure-silk-saree.png?v=1776415386',alt:'Yellow and pink Gadwal handloom silk saree',colors:['#b6a33e','#cf5b78']},
  {id:4,name:'Neelambari Soft Silk',category:'Everyday',price:1899,badge:'LIGHT & LOVELY',detail:'Soft silk · Easy drape',description:'A thoughtfully chosen everyday saree with a graceful drape and a story woven into every detail. Includes an unstitched blouse piece.',image:'https://moolchandmill.com/cdn/shop/files/WhatsAppImage2026-02-13at2.36.37PM_1548x.jpg?v=1770985519',alt:'Pink and teal soft silk saree with woven border',colors:['#bd567b','#287d78']},
  {id:5,name:'Mayuri Pure Silk',category:'Silk',price:4299,badge:'PURE SILK',detail:'Pure silk · Woven motifs',description:'A thoughtfully chosen pure silk saree with a graceful drape and a story woven into every detail. Includes an unstitched blouse piece.',image:'https://cdn.shopify.com/s/files/1/0902/3202/files/91A160-_355-DSC_1349.jpg?v=1684691119',alt:'Teal pure silk saree with rich gold floral motifs',colors:['#14676b','#c5a15a']},
  {id:6,name:'Gulnaar Zari Saree',category:'Festive',price:3199,badge:'CELEBRATION EDIT',detail:'Silk blend · Zari pallu',description:'A thoughtfully chosen celebration saree with a graceful drape and a story woven into every detail. Includes an unstitched blouse piece.',image:'https://images.cbazaar.com/images/kanchipuram-zari-cream-silk-saree-with-blouse-for-traditional-women-sadsf7398-u.jpg',alt:'Cream Kanchipuram saree with maroon and gold border',colors:['#eee0c8','#853e43']},
  {id:7,name:'Madhubani Cotton',category:'Cotton',price:1499,badge:'EASY EVERYDAY',detail:'Handloom cotton · Soft feel',description:'A thoughtfully chosen cotton saree with a graceful drape and a story woven into every detail. Includes an unstitched blouse piece.',image:'https://stimg.b-cdn.net/images/500/data/2022y/September/35512/Traditional-Wear-Green-Zari-Work-Silk-Saree-BANGLORESILK-03.jpg',alt:'Green Indian saree with traditional gold motifs',colors:['#425c43','#a64439']},
  {id:8,name:'Kesar Festive Drape',category:'Festive',price:2599,badge:'MAKER FAVOURITE',detail:'Art silk · Contrast border',description:'A thoughtfully chosen festive saree with a graceful drape and a story woven into every detail. Includes an unstitched blouse piece.',image:'https://d2wo2o4icj5j57.cloudfront.net/Jeenalavie/BlogImages/Blog-143/image1.jpg',alt:'Red and gold Indian saree styled for a celebration',colors:['#a53d37','#cf9b42']}
];

window.AABHA_COLOR_LABELS = {
  1:['Saffron','Rani pink','Antique gold'],2:['Deep red','Antique gold'],3:['Haldi yellow','Rose pink'],4:['Rose pink','Peacock teal'],
  5:['Peacock teal','Antique gold'],6:['Ivory','Maroon'],7:['Forest green','Rust'],8:['Sindoor red','Gold']
};
const aabhaAlternatePhotos={1:[4,6],2:[6],3:[7],4:[5],5:[4],6:[2],7:[5],8:[1]};
window.AABHA_DEFAULT_PRODUCTS.forEach(product=>{
  product.colorNames=window.AABHA_COLOR_LABELS[product.id]||['Colour'];
  product.variants=product.colors.map((color,index)=>({
    name:product.colorNames[index]||`Colour ${index+1}`,
    color,
    image:index===0?product.image:(window.AABHA_DEFAULT_PRODUCTS.find(item=>item.id===aabhaAlternatePhotos[product.id]?.[index-1])?.image||product.image)
  }));
});

window.loadAabhaProducts = function () {
  try {
    const saved = JSON.parse(localStorage.getItem('aabhaProducts') || 'null');
    if (Array.isArray(saved)) return saved.map(product=>{
      const base=window.AABHA_DEFAULT_PRODUCTS.find(item=>item.id===Number(product.id));
      const colorNames=product.colorNames||base?.colorNames||window.AABHA_COLOR_LABELS[product.id]||[];
      const colors=product.colors||base?.colors||[];
      const variants=product.variants||colorNames.map((name,index)=>({name,color:colors[index]||'#9b5447',image:product.images?.[index]||base?.variants?.[index]?.image||product.image}));
      return {...product,colorNames,colors,variants,inStock:product.inStock!==false};
    });
  } catch {}
  return window.AABHA_DEFAULT_PRODUCTS.map(product => ({...product, colors:[...product.colors]}));
};

