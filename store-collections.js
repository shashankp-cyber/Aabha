(()=>{
  const filterList=document.querySelector('.filter-list');
  if(!filterList||!window.loadAabhaCategories)return;

  function belongsToCategory(product,category){
    if(String(product.category||'').toLocaleLowerCase()===category.toLocaleLowerCase())return true;
    return category.toLocaleLowerCase()==='kanchivaram'&&/kanchi(?:puram|varam)/i.test(`${product.name||''} ${product.detail||''} ${product.description||''} ${product.alt||''}`);
  }
  function renderCollectionFilters(){
    const categories=window.loadAabhaCategories();
    let products=[];
    try{products=window.loadAabhaProducts();}catch{}
    const allButton=document.createElement('button');
    allButton.type='button';
    allButton.className='filter-chip selected';
    allButton.dataset.category='All';
    allButton.append(document.createTextNode('All sarees '));
    const allCount=document.createElement('span');
    allCount.textContent=String(products.length).padStart(2,'0');
    allButton.append(allCount);
    const buttons=categories.map(category=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='filter-chip';
      button.dataset.category=category;
      button.append(document.createTextNode(category));
      const count=products.filter(product=>belongsToCategory(product,category)).length;
      if(count){
        const badge=document.createElement('span');
        badge.textContent=String(count).padStart(2,'0');
        button.append(badge);
      }
      return button;
    });
    filterList.replaceChildren(allButton,...buttons);
  }

  renderCollectionFilters();
  window.addEventListener('aabha:categories-updated',renderCollectionFilters);
  window.addEventListener('storage',event=>{
    if(event.key==='aabhaCategories')renderCollectionFilters();
  });
})();
