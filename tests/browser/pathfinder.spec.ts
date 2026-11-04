import {test,expect} from '@playwright/test';
async function open(page: import('@playwright/test').Page){
 await page.getByRole('navigation',{name:'Game navigation'}).getByRole('button',{name:'Resources',exact:true}).click();
 await page.getByRole('button',{name:'Pathfinder',exact:true}).click();
}
test('Pathfinder has one integrated workspace and retains a previously configured companion',async({page})=>{
 await page.goto('/');await open(page);
 await expect(page.getByRole('link',{name:'Open Pathfinder',exact:true})).toHaveCount(1);
 await expect(page.getByRole('link',{name:'Open Pathfinder',exact:true})).toHaveAttribute('href','/campus-workspace');
 await expect(page.getByRole('link',{name:'Indoor Map',exact:true})).toHaveAttribute('href','/indoor-map/');
 await expect(page.getByRole('link',{name:'Open existing companion',exact:true})).toHaveCount(0);
 await page.evaluate(()=>localStorage.setItem('campus-pathfinder-origin','https://facilities.example.org'));
 await page.reload();await open(page);
 await page.getByText('Previously configured companion deployment',{exact:true}).click();
 await expect(page.getByRole('link',{name:'Open existing companion',exact:true})).toHaveAttribute('href','https://facilities.example.org');
 await expect(page.getByRole('link',{name:'Open existing companion',exact:true})).toHaveAttribute('rel','noopener noreferrer');
 await page.getByRole('button',{name:'Learn',exact:true}).click();
 await expect(page.getByLabel('Preparedness practice')).toBeVisible();
});
