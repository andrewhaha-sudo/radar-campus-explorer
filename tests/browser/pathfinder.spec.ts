import {test,expect} from '@playwright/test';
async function open(page: import('@playwright/test').Page){
 await page.getByRole('navigation',{name:'Game navigation'}).getByRole('button',{name:'Resources',exact:true}).click();
 await page.getByRole('button',{name:'Pathfinder',exact:true}).click();
}
test('full portal launcher persists a validated address without sending profile data',async({page})=>{
 await page.goto('/');await open(page);
 await expect(page.getByRole('link',{name:'Open Pathfinder',exact:true})).toHaveAttribute('href','http://127.0.0.1:8082');
 await page.getByLabel('Pathfinder portal address').fill('https://facilities.example.org');
 await page.getByRole('button',{name:'Save portal address'}).click();
 await expect(page.getByRole('status')).toContainText('Portal address saved');
 await page.reload();await open(page);
 await expect(page.getByRole('link',{name:'Open Pathfinder',exact:true})).toHaveAttribute('href','https://facilities.example.org');
 await expect(page.getByRole('link',{name:'Open Pathfinder',exact:true})).toHaveAttribute('rel','noopener noreferrer');
 await page.getByLabel('Pathfinder portal address').fill('https://user:secret@facilities.example.org');
 await page.getByRole('button',{name:'Save portal address'}).click();
 await expect(page.getByRole('status')).toContainText('Do not include credentials');
 await expect(page.getByRole('link',{name:'Open Pathfinder',exact:true})).toHaveAttribute('href','https://facilities.example.org');
 await page.getByRole('button',{name:'Learn',exact:true}).click();
 await expect(page.getByLabel('Preparedness practice')).toBeVisible();
});
