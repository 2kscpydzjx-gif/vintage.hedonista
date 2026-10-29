const base='http://127.0.0.1:8765';
const product={id:'admin-product',slug:'admin-jacket',name:'Вінтажний вовняний жакет із довгою назвою та оздобленням',brand:'Vintage brand',price:1800,stock:1,status:'published',category_id:'admin-category',cover_image:base+'/assets/test-upload.png',created_at:'2026-10-28',product_images:[],categories:{id:'admin-category',name:'Жакети'}};
const order={id:'admin-order',order_number:123,customer_name:'Олена Ковальчук',phone:'+380671234567',email:'customer@example.test',amount:1800,status:'new',created_at:'2026-10-28',product_id:product.id,products:product,comment:'Зателефонуйте після 18:00',city:'Івано-Франківськ',delivery_address:'Відділення №12'};
const customer={id:'admin-customer',first_name:'Олена',last_name:'Ковальчук',full_name:'Олена Ковальчук',email:'longcustomer@example.test',phone:'+380671234567',city:'Івано-Франківськ',orders_count:2,orders_total:3600};
async function seedAdmin(f){
 const gallery=[0,1,2].map(i=>({id:'gallery-'+i,product_id:product.id,image_url:product.cover_image+'?gallery='+i,sort_order:i,alt_text:'Фото '+i}));
 f.data('products',[{...product,product_images:gallery}]);f.data('categories',[{id:'admin-category',name:'Жакети',slug:'jackets',is_active:true,sort_order:0},{id:'admin-category-2',name:'Сукні',slug:'dresses',is_active:true,sort_order:1}]);
 f.data('product_images',[0,1,2].map(i=>({id:'gallery-'+i,product_id:product.id,image_url:product.cover_image+'?gallery='+i,sort_order:i,alt_text:'Фото '+i})));
 f.data('subcategories',[{id:'admin-subcategory',category_id:'admin-category',name:'Вовняні',slug:'wool'}]);
 f.data('orders',[order]);f.data('customer_profiles',[customer]);
 f.data('news',[{id:'admin-article',title:'Як обрати вінтажний жакет із довгою назвою статті',slug:'admin-article',status:'draft',content:'VH_HTML_V1:<p>Оригінальний текст статті</p><figure data-vh-width="25" data-vh-align="right"><img src="'+product.cover_image+'" alt="Фото статті"></figure>',excerpt:'Короткий опис статті',category:'СТИЛЬ',cover_image:product.cover_image,created_at:'2026-10-28'}]);
 f.data('media_library',[{id:'admin-media',filename:'Фотографія з довгою назвою.png',public_url:product.cover_image,storage_path:'products/test.png',category:'products',created_at:'2026-10-28'}]);
 f.data('capsule_styles',[{id:'admin-style',title:'Вінтажний стиль',slug:'vintage-style',is_active:true,image_url:product.cover_image}]);
 f.data('capsules',[{id:'admin-capsule',style_id:'admin-style',title:'Капсула із довгою назвою',slug:'admin-capsule',price:1800,is_active:true,cover_image:product.cover_image}]);
 f.data('capsule_looks',[{id:'admin-look',capsule_id:'admin-capsule',title:'Головний образ',is_main:true,sort_order:0}]);
 f.data('capsule_look_products',[{capsule_id:'admin-capsule',look_id:'admin-look',product_id:product.id,sort_order:0}]);
 f.rpc(async({name})=>({data:name==='is_admin'?true:name==='admin_list_customers_v131'?[customer]:name==='admin_customer_profile_v131'?{profile:customer,orders:[order]}:[],error:null}));
}
module.exports={seedAdmin,base,product,order,customer};
