import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:950}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));let id='';
try{
  await page.goto('http://localhost:4317/code/atlas');
  const frame=page.frameLocator('iframe[title="Code Studio workspace"]');
  await frame.getByRole('button',{name:'＋ Create project'}).click();
  await frame.getByRole('dialog').getByLabel('Name').fill('Workspace test '+Date.now());
  await frame.getByRole('button',{name:'Create project',exact:true}).click();
  await expect(frame.locator('.cs-pane-heading')).toContainText('0');
  await expect(frame.locator('.cs-preview-status')).toContainText('Create or import');
  id=await frame.locator('.cs-root').evaluate(async()=>{const projects=await fetch('/api/projects').then(r=>r.json());return projects[0].id});
  await frame.locator('.cs-file-menu>summary').click();
  await frame.getByRole('button',{name:'＋ File'}).click();
  await frame.getByRole('dialog').getByLabel('Path').fill('index.html');
  await frame.getByRole('button',{name:'Confirm'}).click();
  await expect(frame.getByRole('button',{name:'index.html',exact:true})).toBeVisible();
  await frame.locator('.monaco-editor').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('<!doctype html><html><body><h1>Built from scratch</h1><form><input name="email"><button>Send</button></form></body></html>');
  await expect(frame.locator('.cs-preview-status')).toContainText('Preview running',{timeout:30000});
  await expect(frame.frameLocator('iframe[title="Component preview"]').getByRole('heading',{name:'Built from scratch'})).toBeVisible();
  await frame.locator('.cs-file-menu>summary').click();
  const upload=frame.locator('input[aria-label="Upload files"]');
  await upload.setInputFiles([
    {name:'styles.scss',mimeType:'text/x-scss',buffer:Buffer.from('body { color: navy; }')},
    {name:'.gitignore',mimeType:'text/plain',buffer:Buffer.from('node_modules')},
    {name:'vite.config.ts',mimeType:'text/plain',buffer:Buffer.from('export default {}')},
  ]);
  await expect(frame.getByRole('button',{name:'styles.scss',exact:true})).toBeVisible();
  await expect(frame.getByRole('button',{name:'.gitignore',exact:true})).toBeVisible();
  const divider=frame.getByRole('separator',{name:'Resize editor and preview'});const before=await divider.boundingBox();
  await divider.hover();await page.mouse.down();await page.mouse.move(before.x+140,before.y+20);await page.mouse.up();const after=await divider.boundingBox();
  expect(after.x).toBeGreaterThan(before.x+100);
  expect(errors).toEqual([]);
  console.log('PASS empty project, own file creation and preview, common project files, resizable editor/preview, no browser errors');
}finally{if(id)await page.evaluate(id=>fetch('/api/projects/'+id,{method:'DELETE'}),id);await browser.close()}
