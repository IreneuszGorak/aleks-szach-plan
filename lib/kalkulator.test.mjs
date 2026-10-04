import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateShoppingList,toGrams,scaleForRecipe} from './kalkulator.mjs';
const data=JSON.parse(readFileSync(new URL('../public/dane_aplikacji.json',import.meta.url)));
const single=(id,amount,unit,measure='')=>({...data,przepisy:[{id:'test',nazwa:'Test',porcje:2,skladniki:[{id,nazwa:id,ilosc:amount,jednostka:unit,miara:measure}]}]});
const calc=(d,opts={})=>calculateShoppingList(d,[{recipeId:'test',servings:2}],opts);
test('all 527 recipe IDs have price and can be added without a retail SKU',()=>{
 const ids=new Set(data.przepisy.flatMap(r=>r.skladniki.map(i=>i.id)));
 assert.equal(ids.size,527);
 for(const id of ids){assert.ok(data.skladniki[id]);assert.ok(data.skladniki[id].cena_za_100g>0);assert.equal(data.skladniki[id].mozna_dodac,true);}
 const garlic=calc(single('czosnek',1,'ząbek'));
 assert.equal(garlic.braki_cen,0);assert.equal(garlic.pozycje.length,1);assert.ok(garlic.suma_pelna>0);
});
test('half a garlic clove costs much less than half a whole head',()=>{
 const result=calc(single('czosnek',.5,'ząbki'));assert.ok(result.kompletna);
 assert.ok(result.pozycje[0].ilosc_g>=1&&result.pozycje[0].ilosc_g<=3);
 assert.ok(result.suma_pelna>0&&result.suma_pelna<.3);
});
test('170g carrot plus one carrot aggregate as mass, never 171g',()=>{
 const d=single('marchew',170,'g');d.przepisy[0].skladniki.push({id:'marchew',ilosc:1,jednostka:'szt.',miara:'1'});
 const r=calc(d);assert.equal(r.pozycje.length,1);assert.ok(r.pozycje[0].ilosc_g>200);assert.equal(r.pozycje[0].pozycje.length,2);assert.ok(r.kompletna);
});
test('tablespoons butter and dried oregano have different gram weights',()=>{
 const butter=toGrams(1,'łyżka',data.skladniki.maslo),oregano=toGrams(1,'łyżka',data.skladniki.oregano_suszone);
 assert.ok(butter.grams>10&&butter.grams<18);assert.ok(oregano.grams>0&&oregano.grams<6);
});
test('bunches, slices and cloves from the report can be priced',()=>{
 for(const [id,unit] of [['cebula_dymka','pęczka'],['pomidory','plastry'],['czosnek','ząbek'],['szynka','plaster']]){
  const r=calc(single(id,1,unit));assert.ok(r.kompletna,id);assert.ok(r.suma_pelna>0,id);
 }
});
test('numeric salt without a unit is not converted to pieces or dropped',()=>{
 const r=calc(single('sol',.5,null,'0.5'));assert.equal(r.pozycje.length,1);assert.equal(r.braki_cen,0);
 assert.equal(r.suma_pelna,null);assert.equal(r.kompletna,false);assert.equal(r.pozycje[0].pozycje[0].cost,null);
 assert.equal(r.pozycje[0].pozycje[0].reason,'quantity_has_no_unit');assert.ok(r.pozycje[0].cena_za_100g>0);
});
test('quantity overrides resolve unclear source without changing original data',()=>{
 const d=single('sol',.5,null,'0.5');const r=calc(d,{quantityOverrides:{'test:0':{amount:.5,unit:'łyżeczka'}}});
 assert.ok(r.kompletna);assert.ok(r.suma_pelna>0);assert.equal(d.przepisy[0].skladniki[0].jednostka,null);
});
test('to-taste budget defaults are optional and never mean no price',()=>{
 const d=single('pieprz',null,null,'do smaku');const r=calc(d);assert.ok(r.kompletna);assert.ok(r.suma_pelna>0);
 const disabled=calc(d,{useTasteDefaults:false});assert.equal(disabled.suma_pelna,null);assert.equal(disabled.braki_cen,0);
});
test('unknown servings require explicit multiplier or declared serving assumption',()=>{
 const d=single('marchew',170,'g');d.przepisy[0].porcje=null;
 assert.equal(calc(d).suma_pelna,null);
 assert.equal(calculateShoppingList(d,[{recipeId:'test',multiplier:.5}]).pozycje[0].ilosc_g,85);
 const assumed=calculateShoppingList(d,[{recipeId:'test',servings:2,assumedBaseServings:4}]);assert.equal(assumed.pozycje[0].ilosc_g,85);assert.equal(assumed.zalozenia[0].type,'assumed_servings');
 assert.equal(d.przepisy[0].porcje,null);
});
test('pantry exclusions require explicit selection; water remains visible at zero cost',()=>{
 const d=single('sol',5,'g');assert.ok(calc(d).suma_pelna>0);assert.equal(calc(d,{pantryIngredientIds:['sol']}).suma_pelna,0);
 const water=calc(single('woda',500,'ml'));assert.equal(water.suma_pelna,0);assert.equal(water.pozycje.length,1);
});
test('range uses upper bound and rounding happens after quantity aggregation',()=>{
 const d=single('marchew',100,'g');d.przepisy[0].skladniki[0].ilosc_max=200;
 assert.equal(calc(d).pozycje[0].ilosc_g,200);assert.equal(calc(d,{useUpperRange:false}).pozycje[0].ilosc_g,100);
});
test('all 300 recipes preserve every line with no missing-price exclusions',()=>{
 for(const recipe of data.przepisy){
  const r=calculateShoppingList(data,[{recipeId:recipe.id,multiplier:1}]);
  assert.equal(r.pozycje.reduce((n,x)=>n+x.pozycje.length,0),recipe.skladniki.length,recipe.id);
  assert.equal(r.braki_cen,0);assert.equal(r.kompletna,r.suma_pelna!==null);
 }
});
test('reported total agrees with displayed rounded ingredient rows',()=>{
 const selected=data.przepisy.slice(0,25).map(r=>({recipeId:r.id,multiplier:.5}));const result=calculateShoppingList(data,selected);
 assert.equal(result.suma_wycenionych_pozycji,Math.round(result.pozycje.reduce((s,r)=>s+r.koszt,0)*100)/100);
});
test('ambiguous salt in actual source recipe remains editable, never pieces',()=>{
 const result=calculateShoppingList(data,[{recipeId:'themealdb:53076',multiplier:.5}]);
 const salt=result.pozycje.find(r=>r.skladnik_id==='sol');assert.equal(salt.wymaga_ilosci,true);assert.equal(salt.pozycje[0].cost,null);
});
