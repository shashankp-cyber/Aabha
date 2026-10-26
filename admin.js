(()=>{
  if(sessionStorage.getItem('aabhaAdminSession')!=='authenticated'){
    window.location.replace('admin-login.html');
    return;
  }

  let products=window.loadAabhaProducts();
  let workingImages=null;
  let previewObjectURLs=[];
  let imageEditPending=0;

  const form=document.querySelector('#product-form');
  const list=document.querySelector('#product-list');
  const searchInput=document.querySelector('#catalog-search');
  const imageInput=document.querySelector('#product-images');
  const previewWrap=document.querySelector('#image-preview-wrap');
  const previewGrid=document.querySelector('#image-preview-grid');
  const statusLine=document.querySelector('#form-status');
  const colorLabelsInput=document.querySelector('#product-color-labels');
  const appendImages=document.querySelector('#append-images');
  const saveButton=document.querySelector('#save-product');

  function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function formatPrice(value){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);}
  function colorToHex(name){
    const value=name.toLowerCase();
    const palette=[['green','#3b7855'],['teal','#287d78'],['red','#9d3e3c'],['maroon','#773d3d'],['pink','#bd567b'],['gold','#c29a4a'],['yellow','#d1ad3c'],['blue','#3d5f9b'],['navy','#263f66'],['purple','#79508f'],['orange','#c86d3d'],['brown','#80523e'],['black','#302c2a'],['white','#f0ece4'],['ivory','#eee0c8'],['grey','#898783'],['gray','#898783']];
    return palette.find(([key])=>value.includes(key))?.[1]||'#9b5447';
  }
  function setStatus(message,isError=false){
    statusLine.textContent=message;
    statusLine.classList.toggle('error',isError);
  }
  function persistCatalog(next){
    try{localStorage.setItem('aabhaProducts',JSON.stringify(next));products=next;return true;}
    catch{setStatus('Could not save. This browser may be out of storage space; try a smaller photo.',true);return false;}
  }
  function productImages(product){
    if(product.images?.length)return [...product.images];
    if(product.variants?.length)return product.variants.map(variant=>variant.image).filter(Boolean);
    return product.image?[product.image]:[];
  }
  function renderCatalog(){
    const query=searchInput.value.trim().toLowerCase();
    const visible=products.filter(product=>`${product.name} ${product.category} ${product.description||''}`.toLowerCase().includes(query));
    document.querySelector('#product-count').textContent=`(${products.length})`;
    document.querySelector('#no-products').hidden=visible.length>0;
    list.innerHTML=visible.map(product=>{
      const inStock=product.inStock!==false;
      const photoCount=Math.max(product.images?.length||0,product.variants?.length||0,1);
      return `<article class="catalog-card ${inStock?'':'is-out-of-stock'}"><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.alt||product.name)}" loading="lazy"><div class="catalog-card-copy"><h3 title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</h3><span class="catalog-price">${formatPrice(product.price)}</span><span class="stock-state ${inStock?'in-stock':'out-of-stock'}">${inStock?'In stock':'Out of stock'}</span><span class="gallery-count">${photoCount} photo${photoCount===1?'':'s'}</span><p>${escapeHTML(product.description||product.detail||product.category)}</p><div class="catalog-card-actions"><button type="button" data-edit-product="${product.id}">Edit</button><button type="button" data-stock-product="${product.id}">${inStock?'Mark out':'Mark in stock'}</button><button type="button" class="remove-product" data-remove-product="${product.id}">Remove</button></div></div></article>`;
    }).join('');
  }
  function clearPreviews(){
    previewObjectURLs.forEach(URL.revokeObjectURL);
    previewObjectURLs=[];
    previewGrid.replaceChildren();
  }
  async function handleGallerySwap(event){
    const input=event.currentTarget;
    const file=input.files?.[0];
    if(!file||!workingImages)return;
    const index=Number(input.dataset.swapPhoto);
    if(!Number.isInteger(index)||index<0||index>=workingImages.length)return;
    imageEditPending++;
    saveButton.disabled=true;
    setStatus(`Preparing replacement for photo ${index+1}…`);
    try{
      const replacement=await imageToDataURL(file);
      workingImages[index]=replacement;
      renderCurrentGallery();
      setStatus(`Photo ${index+1} replaced in the edit preview. Save product changes to apply it.`);
    }catch(error){setStatus(error.message,true);}
    finally{
      if(input.isConnected)input.value='';
      imageEditPending--;
      saveButton.disabled=imageEditPending>0;
    }
  }
  function renderCurrentGallery(){
    clearPreviews();
    const queued=imageInput.files?.length||0;
    if(!workingImages?.length){
      previewGrid.innerHTML='<p class="gallery-empty">No saved photos. Add at least one photo below before saving.</p>';
    }else{
      previewGrid.innerHTML=workingImages.map((source,index)=>`<div class="image-preview-item"><img src="${escapeHTML(source)}" alt="Saved saree photo ${index+1}"><div class="image-preview-actions"><label class="image-swap-label">Replace<input class="gallery-swap-input" type="file" accept="image/png,image/jpeg,image/webp" data-swap-photo="${index}" aria-label="Choose a replacement for photo ${index+1}"></label><button type="button" class="remove-photo-button" data-remove-photo="${index}">Remove</button></div></div>`).join('');
      previewGrid.querySelectorAll('[data-swap-photo]').forEach(input=>input.addEventListener('change',handleGallerySwap));
    }
    const mode=appendImages.checked?'will be added to this gallery':'will replace this gallery';
    document.querySelector('#image-preview-label').textContent=queued?`Saved photos: ${workingImages.length} · ${queued} new photo${queued===1?'':'s'} ${mode}.`:`Current gallery · ${workingImages.length} photo${workingImages.length===1?'':'s'} · replace or remove individually.`;
    previewWrap.hidden=false;
  }
  function showNewPreviews(files){
    clearPreviews();
    for(const file of files){
      const url=URL.createObjectURL(file);
      previewObjectURLs.push(url);
      const item=document.createElement('div');
      item.className='image-preview-item new-image-preview';
      const image=document.createElement('img');
      image.src=url;
      image.alt=file.name;
      item.append(image);
      previewGrid.append(item);
    }
    document.querySelector('#image-preview-label').textContent=`${files.length} new photo${files.length===1?'':'s'} selected`;
    previewWrap.hidden=files.length===0;
  }
  function clearForm(){
    form.reset();
    workingImages=null;
    imageEditPending=0;
    saveButton.disabled=false;
    document.querySelector('#product-id').value='';
    document.querySelector('#form-mode').textContent='NEW PRODUCT';
    document.querySelector('#editor-title').textContent='Add a saree';
    saveButton.innerHTML='Add saree to storefront <span>↗</span>';
    document.querySelector('#photo-hint').textContent='Choose up to 5 JPG, PNG, or WebP images.';
    document.querySelector('#append-images-row').hidden=true;
    clearPreviews();
    previewWrap.hidden=true;
    setStatus('');
  }
  function editProduct(id,focusPhoto=false){
    const product=products.find(item=>String(item.id)===String(id));
    if(!product)return;
    workingImages=productImages(product);
    document.querySelector('#product-id').value=product.id;
    document.querySelector('#product-name').value=product.name;
    document.querySelector('#product-price').value=product.price;
    document.querySelector('#product-category').value=product.category;
    document.querySelector('#product-detail').value=product.detail||'';
    document.querySelector('#product-description').value=product.description||'';
    document.querySelector('#product-badge').value=product.badge||'';
    colorLabelsInput.value=(product.variants||[]).map(variant=>variant.name).join(', ');
    imageInput.value='';
    appendImages.checked=true;
    document.querySelector('#append-images-row').hidden=false;
    document.querySelector('#form-mode').textContent='EDIT PRODUCT';
    document.querySelector('#editor-title').textContent=product.name;
    saveButton.innerHTML='Save product changes <span>↗</span>';
    document.querySelector('#photo-hint').textContent='Replace or remove saved photos below, or upload more.';
    renderCurrentGallery();
    setStatus('');
    if(focusPhoto)imageInput.focus();
    document.querySelector('.editor-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function imageToDataURL(file){
    return new Promise((resolve,reject)=>{
      if(!file.type.startsWith('image/')){reject(new Error('Choose an image file.'));return;}
      const objectURL=URL.createObjectURL(file);
      const image=new Image();
      image.onload=()=>{
        const scale=Math.min(1,1100/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const context=canvas.getContext('2d');
        context.fillStyle='#ffffff';
        context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        URL.revokeObjectURL(objectURL);
        let result=canvas.toDataURL('image/jpeg',.78);
        if(result.length>360000){
          const smaller=document.createElement('canvas');
          smaller.width=Math.max(1,Math.round(canvas.width*.72));
          smaller.height=Math.max(1,Math.round(canvas.height*.72));
          smaller.getContext('2d').drawImage(image,0,0,smaller.width,smaller.height);
          result=smaller.toDataURL('image/jpeg',.67);
        }
        if(result.length>360000){reject(new Error('This image is too large for browser storage. Choose a smaller image.'));return;}
        resolve(result);
      };
      image.onerror=()=>{URL.revokeObjectURL(objectURL);reject(new Error('Could not read this image. Try another image.'));};
      image.src=objectURL;
    });
  }

  imageInput.addEventListener('change',()=>{
    const files=[...(imageInput.files||[])];
    if(files.length>5){setStatus('Choose up to 5 images per upload.',true);imageInput.value='';return;}
    if(document.querySelector('#product-id').value)renderCurrentGallery();
    else showNewPreviews(files);
    setStatus('');
  });
  appendImages.addEventListener('change',()=>{
    if(document.querySelector('#product-id').value)renderCurrentGallery();
  });
  previewGrid.addEventListener('click',event=>{
    const remove=event.target.closest('[data-remove-photo]');
    if(!remove||!workingImages)return;
    const index=Number(remove.dataset.removePhoto);
    if(!Number.isInteger(index)||index<0||index>=workingImages.length)return;
    workingImages.splice(index,1);
    const names=colorLabelsInput.value.split(',').map(name=>name.trim()).filter(Boolean);
    if(index<names.length){names.splice(index,1);colorLabelsInput.value=names.join(', ');}
    renderCurrentGallery();
    setStatus('Photo removed from the edit preview. Save product changes to apply it.');
  });
  searchInput.addEventListener('input',renderCatalog);
  list.addEventListener('click',event=>{
    const remove=event.target.closest('[data-remove-product]');
    if(remove){
      const product=products.find(item=>String(item.id)===remove.dataset.removeProduct);
      if(!product||!window.confirm(`Remove “${product.name}” from the storefront?`))return;
      const next=products.filter(item=>String(item.id)!==String(product.id));
      if(persistCatalog(next)){
        if(document.querySelector('#product-id').value===String(product.id))clearForm();
        renderCatalog();
        setStatus(`${product.name} removed from the catalog.`);
      }
      return;
    }
    const stock=event.target.closest('[data-stock-product]');
    if(stock){
      const product=products.find(item=>String(item.id)===stock.dataset.stockProduct);
      if(!product)return;
      const updated={...product,inStock:product.inStock===false};
      const next=products.map(item=>String(item.id)===String(product.id)?updated:item);
      if(persistCatalog(next)){renderCatalog();setStatus(`${product.name} marked ${updated.inStock?'in stock':'out of stock'}.`);}
      return;
    }
    const edit=event.target.closest('[data-edit-product]');
    if(edit){editProduct(edit.dataset.editProduct);return;}
    const photo=event.target.closest('[data-edit-photo]');
    if(photo){editProduct(photo.dataset.editPhoto,true);imageInput.click();}
  });
  document.querySelector('#reset-form').addEventListener('click',clearForm);

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(imageEditPending){setStatus('Wait for the replacement photo to finish loading.',true);return;}
    setStatus('');
    const existingId=document.querySelector('#product-id').value;
    const existing=existingId?products.find(item=>String(item.id)===existingId):null;
    let images=existing?[...(workingImages||productImages(existing))]:[];
    const files=[...(imageInput.files||[])];
    if(files.length){
      try{
        setStatus(`Preparing ${files.length} photo${files.length===1?'':'s'}…`);
        const uploaded=await Promise.all(files.map(imageToDataURL));
        images=existing&&appendImages.checked?[...images,...uploaded]:uploaded;
      }catch(error){setStatus(error.message,true);return;}
    }
    if(!images.length){setStatus('Keep or upload at least one saree photo before saving.',true);return;}
    const colorNames=colorLabelsInput.value.split(',').map(name=>name.trim()).filter(Boolean);
    if(colorNames.length>images.length){setStatus('Add one photo for each color option, in the same order, or remove extra color names.',true);return;}
    const variants=colorNames.map((name,index)=>{
      const old=existing?.variants?.find(variant=>variant.name===name)||existing?.variants?.[index];
      return {name,color:old?.color||colorToHex(name),image:images[index]};
    });
    const name=document.querySelector('#product-name').value.trim();
    const category=document.querySelector('#product-category').value;
    const product={
      id:existing?existing.id:Date.now(),
      name,
      category,
      price:Number(document.querySelector('#product-price').value),
      badge:document.querySelector('#product-badge').value.trim()||'NEW ARRIVAL',
      detail:document.querySelector('#product-detail').value.trim()||category,
      description:document.querySelector('#product-description').value.trim(),
      image:images[0],
      images,
      alt:name,
      variants,
      colorNames,
      colors:variants.map(variant=>variant.color),
      inStock:existing?existing.inStock!==false:true
    };
    const next=existing?products.map(item=>String(item.id)===String(existing.id)?product:item):[product,...products];
    if(persistCatalog(next)){
      renderCatalog();
      clearForm();
      setStatus(existing?`Product updated with ${images.length} photo${images.length===1?'':'s'} and ${variants.length} color option${variants.length===1?'':'s'}. The storefront updates automatically.`:`Saree added with ${images.length} photo${images.length===1?'':'s'} and ${variants.length} color option${variants.length===1?'':'s'}. The storefront updates automatically.`);
    }
  });

  document.querySelector('#admin-logout').addEventListener('click',()=>{
    sessionStorage.removeItem('aabhaAdminSession');
    window.location.replace('admin-login.html');
  });
  renderCatalog();
})();
