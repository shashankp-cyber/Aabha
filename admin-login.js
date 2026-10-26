const demoUsername='aabhaadmin';
const demoPassword='AabhaDemo@2026';
const loginForm=document.querySelector('#admin-login-form');
const loginStatus=document.querySelector('#login-status');

document.querySelector('#use-demo').addEventListener('click',()=>{
  document.querySelector('#admin-username').value=demoUsername;
  document.querySelector('#admin-password').value=demoPassword;
  loginStatus.textContent='Demo login details filled. Select Sign in to manager.';
});

loginForm.addEventListener('submit',event=>{
  event.preventDefault();
  const username=document.querySelector('#admin-username').value.trim();
  const password=document.querySelector('#admin-password').value;
  if(username.toLowerCase()!==demoUsername||password!==demoPassword){
    loginStatus.textContent='The username or password is incorrect. Use the local demo login shown below.';
    return;
  }
  sessionStorage.setItem('aabhaAdminSession','authenticated');
  window.location.replace('admin.html');
});
