import { AppDataSource } from '../../data-source';
import { User } from '../entities/user.entity';
import { Business } from '../entities/business.entity';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';
import { Purchase } from '../entities/purchase.entity';

type ProductSeed = {
  name: string;
  price: string;
  unit: 'unidad' | 'kg';
  category: string;
  stock: string;
  avgCost: string;
};

const BUSINESSES: { name: string; products: ProductSeed[] }[] = [
  {
    name: 'Frutería El Sol',
    products: [
      { name: 'Manzana', price: '4.50', unit: 'kg', category: 'Frutas', stock: '50', avgCost: '2.80' },
      { name: 'Plátano', price: '2.50', unit: 'kg', category: 'Frutas', stock: '80', avgCost: '1.20' },
      { name: 'Naranja', price: '3.00', unit: 'kg', category: 'Frutas', stock: '60', avgCost: '1.50' },
      { name: 'Palta', price: '6.00', unit: 'kg', category: 'Frutas', stock: '40', avgCost: '3.50' },
      { name: 'Piña', price: '5.00', unit: 'unidad', category: 'Frutas', stock: '25', avgCost: '3.00' },
      { name: 'Fresa', price: '8.00', unit: 'kg', category: 'Frutas', stock: '20', avgCost: '5.00' },
    ],
  },
  {
    name: 'Moda Express',
    products: [
      { name: 'Polo básico', price: '25.00', unit: 'unidad', category: 'Ropa', stock: '40', avgCost: '12.00' },
      { name: 'Jean clásico', price: '65.00', unit: 'unidad', category: 'Ropa', stock: '25', avgCost: '35.00' },
      { name: 'Casaca de cuero', price: '180.00', unit: 'unidad', category: 'Ropa', stock: '8', avgCost: '110.00' },
      { name: 'Zapatillas urbanas', price: '120.00', unit: 'unidad', category: 'Calzado', stock: '15', avgCost: '70.00' },
      { name: 'Gorra', price: '20.00', unit: 'unidad', category: 'Accesorios', stock: '30', avgCost: '8.00' },
      { name: 'Vestido casual', price: '55.00', unit: 'unidad', category: 'Ropa', stock: '18', avgCost: '28.00' },
    ],
  },
];

async function seed() {
  const username = process.env.SEED_USERNAME;
  if (!username) {
    throw new Error('SEED_USERNAME debe estar definido en el .env');
  }

  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const businessRepo = AppDataSource.getRepository(Business);
  const productRepo = AppDataSource.getRepository(Product);
  const purchaseRepo = AppDataSource.getRepository(Purchase);
  const saleRepo = AppDataSource.getRepository(Sale);

  const owner = await userRepo.findOneBy({ username });
  if (!owner) {
    throw new Error(`Usuario "${username}" no existe todavía — corre seed:user primero.`);
  }

  for (const businessSeed of BUSINESSES) {
    const existing = await businessRepo.findOneBy({ owner: { id: owner.id }, name: businessSeed.name });
    if (existing) {
      console.log(`Negocio "${businessSeed.name}" ya existe, se omite.`);
      continue;
    }

    const business = await businessRepo.save(businessRepo.create({ owner, name: businessSeed.name }));

    const products = await productRepo.save(
      businessSeed.products.map((p) =>
        productRepo.create({
          business,
          name: p.name,
          price: p.price,
          unit: p.unit,
          category: p.category,
          stock: p.stock,
          avgCost: p.avgCost,
        }),
      ),
    );

    // compra inicial de stock para cada producto (respaldo del avg_cost)
    await purchaseRepo.save(
      products.map((product, i) =>
        purchaseRepo.create({
          business,
          product,
          quantity: businessSeed.products[i].stock,
          unitCost: businessSeed.products[i].avgCost,
        }),
      ),
    );

    // par de ventas de ejemplo por producto, una de ellas con descuento
    const sales: Sale[] = [];
    for (const product of products) {
      const listPrice = product.price;
      sales.push(
        saleRepo.create({
          business,
          product,
          quantity: product.unit === 'kg' ? '2.00' : '1.00',
          listPrice,
          unitPrice: listPrice,
          unitCost: product.avgCost,
          paymentMethod: 'efectivo',
        }),
      );
    }
    // una venta con regateo para mostrar el descuento
    const firstProduct = products[0];
    sales.push(
      saleRepo.create({
        business,
        product: firstProduct,
        quantity: '3.00',
        listPrice: firstProduct.price,
        unitPrice: (Number(firstProduct.price) * 0.9).toFixed(2),
        unitCost: firstProduct.avgCost,
        paymentMethod: 'yape',
      }),
    );
    await saleRepo.save(sales);

    console.log(`Negocio "${businessSeed.name}" sembrado con ${products.length} productos.`);
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Error al sembrar datos de ejemplo:', err);
  process.exit(1);
});
