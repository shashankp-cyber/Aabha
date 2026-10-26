(()=>{
  const form=document.querySelector('#collection-form');
  const nameInput=document.querySelector('#new-collection-name');
  const categorySelect=document.querySelector('#product-category');
  const collectionList=document.querySelector('#collection-list');
  const status=document.querySelector('#collection-status');
  if(!form||!categorySelect||!collectionList||!window.loadAabhaCategories)return;

  function setStatus(message,isError=false){
    status.textContent=message;
    status.classList.toggle('error',isError);
  }
  function refresh(preferredCategory=categorySelect.value){
    const categories=window.loadAabhaCategories();
    let products=[];
    try{products=window.loadAabhaProducts();}catch{}
    const usage=new Map(categories.map(category=>[category.toLocaleLowerCase(),0]));
    products.forEach(product=>{
      const key=String(product.category||'').toLocaleLowerCase();
      if(usage.has(key))usage.set(key,usage.get(key)+1);
      const mentionsKanchivaram=/kanchi(?:puram|varam)/i.test(`${product.name||''} ${product.detail||''} ${product.description||''} ${product.alt||''}`);
      if(mentionsKanchivaram&&key!=='kanchivaram'&&usage.has('kanchivaram'))usage.set('kanchivaram',usage.get('kanchivaram')+1);
    });
    categorySelect.replaceChildren(...categories.map(category=>{
      const option=document.createElement('option');
      option.value=category;
      option.textContent=category;
      return option;
    }));
    categorySelect.value=categories.includes(preferredCategory)?preferredCategory:(categories.includes('Silk')?'Silk':categories[0]||'');
    collectionList.replaceChildren(...categories.map(category=>{
      const chip=document.createElement('div');
      chip.className='collection-chip';
      const label=document.createElement('strong');
      label.textContent=category;
      const count=document.createElement('small');
      count.textContent=`${usage.get(category.toLocaleLowerCase())||0} sarees`;
      const remove=document.createElement('button');
      remove.type='button';
      remove.className='remove-collection-button';
      remove.dataset.removeCollection=category;
      remove.setAttribute('aria-label',`Remove ${category} collection`);
      remove.textContent='Remove';
      chip.append(label,count,remove);
      return chip;
    }));
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    const name=nameInput.value.trim().replace(/\s+/g,' ');
    if(name.length<2){setStatus('Enter a collection name with at least 2 characters.',true);nameInput.focus();return;}
    const categories=window.loadAabhaCategories();
    const existing=categories.find(category=>category.toLocaleLowerCase()===name.toLocaleLowerCase());
    if(existing){setStatus(`“${existing}” is already available in the collection list.`,true);categorySelect.value=existing;nameInput.focus();return;}
    try{
      localStorage.setItem('aabhaCategories',JSON.stringify([...categories,name]));
      refresh(name);
      form.reset();
      setStatus(`“${name}” collection added. You can assign it to a saree now.`);
      window.dispatchEvent(new CustomEvent('aabha:categories-updated'));
    }catch{
      setStatus('Could not save the collection in this browser.',true);
    }
  });

  collectionList.addEventListener('click',event=>{
    const removeButton=event.target.closest('[data-remove-collection]');
    if(!removeButton)return;
    const category=removeButton.dataset.removeCollection;
    const categories=window.loadAabhaCategories();
    if(categories.length<=1){setStatus('Keep at least one collection available for new sarees.',true);return;}
    let products=[];
    try{products=window.loadAabhaProducts();}catch{}
    const assigned=products.filter(product=>String(product.category||'').toLocaleLowerCase()===category.toLocaleLowerCase());
    if(assigned.length){setStatus(`Reassign ${assigned.length} ${assigned.length===1?'saree':'sarees'} from “${category}” before removing this collection.`,true);return;}
    if(!window.confirm(`Remove the “${category}” collection from the storefront?`))return;
    const next=categories.filter(value=>value.toLocaleLowerCase()!==category.toLocaleLowerCase());
    try{
      localStorage.setItem('aabhaCategories',JSON.stringify(next));
      refresh(categorySelect.value===category?'':categorySelect.value);
      setStatus(`“${category}” collection removed.`);
      window.dispatchEvent(new CustomEvent('aabha:categories-updated'));
    }catch{setStatus('Could not remove the collection in this browser.',true);}
  });

  window.addEventListener('storage',event=>{
    if(event.key==='aabhaCategories'||event.key==='aabhaProducts')refresh();
  });
  refresh();
})();
