
const SPREADSHEET_ID = '12wPGal_n7PKYFGz9W__bXgK4mly2NbrEEGwTrIDCzcI';
const SHEET_NAME = '2026 Base Catalogo Precifica V2';
const CLIENTS_SHEET = 'Relacao Clientes Sysmo';
const ROUTES_SHEET = 'Rotas Dias De Entrega';
const INCOMING_SHEET = 'ENTRADAS_ESTOQUE';
// ✅ abas definidas pelo Cássio (planilha oficial)
// Reservas reais são lidas via Vercel Function (/api/reservas), mas mantemos o nome para compat.
const RESERVATIONS_SHEET = 'RESERVAS';

function _isBadCell(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  if (!s) return true;
  const up = s.toUpperCase();
  return up === '#N/A' || up === '#REF!' || up === '#VALUE!' || up === '#ERROR!' || up === 'N/A';
}

// Task 1: Update CACHE_PREFIX
const CACHE_PREFIX = 'schlosser_cache_v14_'; 
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Reservas (via Vercel Function) - cache curto pra não bater API toda hora
const RESERVATIONS_CACHE_KEY = `${CACHE_PREFIX}reservations_api`;
const RESERVATIONS_CACHE_DURATION = 60 * 1000; // 1 minute

export const schlosserApi = {
  _getCache(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) return data;
      localStorage.removeItem(key);
    } catch (e) { localStorage.removeItem(key); }
    return null;
  },

  _setCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data })); } catch (e) {}
  },

  _getReservationsCache() {
    try {
      const cached = localStorage.getItem(RESERVATIONS_CACHE_KEY);
      if (!cached) return null;
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < RESERVATIONS_CACHE_DURATION) return data;
      localStorage.removeItem(RESERVATIONS_CACHE_KEY);
    } catch (e) {
      localStorage.removeItem(RESERVATIONS_CACHE_KEY);
    }
    return null;
  },

  _setReservationsCache(data) {
    try { localStorage.setItem(RESERVATIONS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })); } catch (e) {}
  },

  _parseGvizResponse(text) {
    try {
      const jsonString = text.substring(text.indexOf("(") + 1, text.lastIndexOf(")"));
      const json = JSON.parse(jsonString);
      if (json.status !== 'ok') return [];
      
      return json.table.rows.map(row => {
        const c = row.c;
        return c.map(cell => (cell ? (cell.v !== null ? cell.v : '') : ''));
      });
    } catch (e) {
      console.error("Error parsing Gviz response", e);
      return [];
    }
  },

  _parseDeliveryDays(text) {
    if (!text || typeof text !== 'string') return [1, 2, 3, 4, 5]; // Default Mon-Fri
    const lower = text.toLowerCase().trim();
    const days = new Set();
    
    // Explicit mapping for Portuguese days
    // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    
    // Check for Domingo (0)
    if (lower.includes('domingo')) days.add(0);
    
    // Check for Segunda (1)
    if (lower.includes('segunda')) days.add(1);
    
    // Check for Terça (2)
    if (lower.includes('terça') || lower.includes('terca')) days.add(2);
    
    // Check for Quarta (3)
    if (lower.includes('quarta')) days.add(3);
    
    // Check for Quinta (4)
    if (lower.includes('quinta')) days.add(4);
    
    // Check for Sexta (5)
    if (lower.includes('sexta')) days.add(5);
    
    // Check for Sábado (6)
    if (lower.includes('sábado') || lower.includes('sabado')) days.add(6);
    
    if (days.size === 0) return [1, 2, 3, 4, 5];

    const result = Array.from(days).sort((a, b) => a - b);
    return result;
  },
  
  _parseDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    
    if (typeof dateInput === 'string') {
        if (dateInput.indexOf('/') > -1) {
            const parts = dateInput.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                return new Date(year, month - 1, day);
            }
        }
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
  },

  // --- PUBLIC / CITY LOGIC ---

  async getCities() {
    const cacheKey = `${CACHE_PREFIX}cities`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    // Normal caching: No _t param, standard fetch
    const query = 'SELECT A, B WHERE B IS NOT NULL';
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(ROUTES_SHEET)}&tq=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url);
      const text = await res.text();
      const rows = this._parseGvizResponse(text);
      
      const uniqueCities = new Set();
      const cities = [];

      rows.forEach(row => {
          const city = row[1]?.trim();
          const route = row[0];
          if (city && !uniqueCities.has(city.toLowerCase())) {
              uniqueCities.add(city.toLowerCase());
              cities.push({
                  name: city,
                  routeId: route
              });
          }
      });

      const sorted = cities.sort((a, b) => a.name.localeCompare(b.name));
      this._setCache(cacheKey, sorted);
      return sorted;
    } catch (e) {
      console.error("Error fetching cities", e);
      return [];
    }
  },

  // Update: Returns all matching routes for a city
  async getRoutesByCity(city) {
      if (!city) return [];
      const routes = await this.getRouteDefinitions();
      const normalizedCity = city.toLowerCase().trim();
      
      // Filter ALL matching rows, not just the first one
      return routes.filter(r => r.city && r.city.toLowerCase().trim() === normalizedCity);
  },

  async _getReservationsApi() {
      // cache curto para não estressar a API
      const cached = this._getCache(RESERVATIONS_CACHE_KEY);
      if (cached && cached.timestamp && (Date.now() - cached.timestamp < RESERVATIONS_CACHE_DURATION)) {
          return cached.data || [];
      }

      try {
          const res = await fetch('/api/reservas', { method: 'GET' });
          const json = await res.json();
          const data = (json && json.ok && Array.isArray(json.reservations)) ? json.reservations : [];
          // salva no cache com timestamp próprio
          this._setCache(RESERVATIONS_CACHE_KEY, { timestamp: Date.now(), data });
          return data;
      } catch (e) {
          console.warn('Falha ao buscar reservas via API, usando fallback local.', e);
          return [];
      }
  },

  // ✅ Compatível com chamadas antigas e do hook useOrders(role, key, orderData)
  async createOrder(roleOrOrderData, maybeKeyOrOrderData, maybeOrderData) {
      const orderData = (maybeOrderData || maybeKeyOrOrderData || roleOrOrderData) || {};
      const { items, clientData, deliveryDate, total } = orderData;

      // 1) Tenta gravar no Google Sheets via Vercel Function
      try {
          const res = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'reserve', order: orderData })
          });
          const out = await res.json();
          if (!out?.ok) throw new Error(out?.error || 'Erro ao reservar no servidor');

          const newOrder = {
              id: out.order.id,
              date: out.order.createdAt,
              deliveryDate,
              client: clientData,
              items,
              total,
              status: out.order.status,
              expiresAt: out.order.expiresAt,
              origin: clientData?.origin || 'app'
          };

          // 2) Mantém uma cópia local pra histórico / UX (não é a fonte de verdade)
          const existing = JSON.parse(localStorage.getItem('schlosser_client_orders') || '[]');
          localStorage.setItem('schlosser_client_orders', JSON.stringify([newOrder, ...existing]));

          // 3) limpa cache para refletir desconto de estoque imediatamente
          localStorage.removeItem(RESERVATIONS_CACHE_KEY);

          return newOrder;
      } catch (e) {
          console.error('Falha ao gravar no Sheets via API. Salvando localmente como contingência.', e);

          // fallback local (não trava operação)
          const newOrder = {
              id: Date.now().toString(),
              date: new Date().toISOString(),
              deliveryDate,
              client: clientData,
              items,
              total,
              status: 'RESERVADO',
              origin: clientData?.origin || 'app'
          };
          const existing = JSON.parse(localStorage.getItem('schlosser_client_orders') || '[]');
          localStorage.setItem('schlosser_client_orders', JSON.stringify([newOrder, ...existing]));
          return newOrder;
      }
  },

  // --- STOCK MANAGEMENT ---

  async getReservations() {
    const cached = this._getReservationsCache();
    if (cached) return cached;

    try {
      const res = await fetch('/api/reservas');
      const json = await res.json();
      const list = (json && json.ok ? json.reservations : []) || [];

      // Normaliza
      const normalized = list.map(r => ({
        sku: String(r.sku),
        qty: Number(r.qty) || 0,
        deliveryDate: r.deliveryDate,
        status: String(r.status || '').toUpperCase(),
        expiresAt: r.expiresAt || null
      })).filter(r => r.sku && r.qty > 0);

      this._setReservationsCache(normalized);
      return normalized;
    } catch (e) {
      // fallback: tentar ler via GVIZ se existir e planilha estiver pública
      try {
        const query = 'SELECT A, B, C, D, E, F, G, H, I, J';
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(RESERVATIONS_SHEET)}&tq=${encodeURIComponent(query)}`;
        const r = await fetch(url);
        const t = await r.text();
        const rows = this._parseGvizResponse(t);
        // Espera colunas conforme nosso padrão do servidor
        // A=orderId B=createdAt C=expiresAt D=status E=deliveryDate F=sku G=descricao H=qty ...
        const normalized = rows.map(row => ({
          sku: String(row[5] || ''),
          qty: Number(row[7] || 0),
          deliveryDate: row[4],
          status: String(row[3] || '').toUpperCase(),
          expiresAt: row[2] || null
        })).filter(r => r.sku && r.qty > 0 && (r.status === 'RESERVADO' || r.status === 'CONFIRMADO'));
        this._setReservationsCache(normalized);
        return normalized;
      } catch {
        return [];
      }
    }
  },

  async getIncomingStock() {
    const cacheKey = `${CACHE_PREFIX}incoming`;
    const cached = this._getCache(cacheKey);
    if (cached) {
        return cached.map(i => ({
            ...i,
            date: this._parseDate(i.date) || new Date(i.date)
        })).filter(i => i.date && !isNaN(i.date.getTime()));
    }

    // Normal caching
    const query = 'SELECT A, B, C';
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(INCOMING_SHEET)}&tq=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url);
      const text = await res.text();
      const rows = this._parseGvizResponse(text);
      
      const incoming = rows.map(row => {
          let dateStr = row[0];
          let dateObj = null;
          if (typeof dateStr === 'string' && dateStr.startsWith('Date')) {
              const parts = dateStr.match(/\d+/g).map(Number);
              dateObj = new Date(parts[0], parts[1], parts[2]);
          } else {
              dateObj = this._parseDate(dateStr) || new Date(dateStr);
          }

          return {
              date: dateObj,
              sku: String(row[1]),
              qty: Number(row[2]) || 0
          };
      }).filter(i => i.sku && i.qty > 0 && i.date && !isNaN(i.date.getTime()));

      this._setCache(cacheKey, incoming);
      return incoming;
    } catch (e) {
      console.error("Error fetching incoming stock", e);
      return [];
    }
  },

  async calculateStockForDates(sku, baseStock, dates) {
      const incomingRaw = await this.getIncomingStock();
      const incoming = incomingRaw.map(i => ({ ...i, date: this._parseDate(i.date) })).filter(i => i.date !== null);

      // ✅ reservas reais (Sheets via Vercel Function)
      const reservationsRaw = await this.getReservations();
      const reservations = reservationsRaw.map(r => ({
        sku: String(r.sku),
        qty: Number(r.qty) || 0,
        date: this._parseDate(r.deliveryDate),
        status: r.status
      })).filter(r => r.sku && r.qty > 0 && r.date);

      const skuStr = String(sku);
      
      return dates.map(dateObj => {
          const date = new Date(dateObj);
          date.setHours(23, 59, 59, 999);

          const relevantIncoming = incoming
              .filter(i => i.sku === skuStr && i.date <= date)
              .reduce((sum, i) => sum + i.qty, 0);

          const relevantReservations = reservations
              .filter(r => r.sku === skuStr && r.date <= date)
              .reduce((sum, r) => sum + r.qty, 0);

          const totalAvailable = Math.max(0, baseStock - relevantReservations + relevantIncoming);

          let status = 'ok';
          if (totalAvailable <= 0) status = 'out';
          else if (totalAvailable <= 5) status = 'low';

          const isIncomingDate = incoming.some(i => {
             if (i.sku !== skuStr) return false;
             return i.date.toDateString() === dateObj.toDateString();
          });

          return {
              date: dateObj,
              available: totalAvailable,
              status,
              incoming: isIncomingDate
          };
      });
  },

  // --- CORE DATA FETCHING ---

  async getProducts(role, key) {
    const cacheKey = `${CACHE_PREFIX}products_full`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    // Normal caching
    // ✅ Mudança solicitada: usar AK (descrição principal) + AJ (descrição técnica)
    // Mantemos E como fallback (compatibilidade)
    // ✅ Inclui coluna G (imagem da marca) para fallback quando AE/AF estiverem vazias
    const query = 'SELECT D, AK, AJ, E, G, H, I, AA, AE, AF WHERE H > 0'; 
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}&tq=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url);
      const text = await res.text();
      const rows = this._parseGvizResponse(text);
      const allIncoming = await this.getIncomingStock();

      const products = rows.map(row => {
        const sku = row[0];
        if (!sku || Number(sku) <= 400000) return null;

        let img = '';
        // row index map (query above):
        // 0=D sku | 1=AK desc principal | 2=AJ desc técnica | 3=E desc antiga | 4=G img marca | 5=H estoque | 6=I peso | 7=AA preço | 8=AE img | 9=AF img alt
        if (row[8] && String(row[8]).startsWith('http')) img = row[8];
        else if (row[9]) {
            const match = String(row[9]).match(/\/d\/([a-zA-Z0-9-_]+)/) || String(row[9]).match(/id=([a-zA-Z0-9-_]+)/);
            if (match) img = `https://drive.google.com/uc?export=view&id=${match[1]}`;
            else if (String(row[9]).startsWith('http')) img = row[9];
        }
        if (img && img.includes('drive.google.com')) img = `https://images.weserv.nl/?url=${encodeURIComponent(img)}`;

        // ✅ Fallback: se não tiver imagem do produto (AE/AF), tenta a imagem da marca (coluna G)
        let imgMarca = '';
        if (row[4]) {
          const v = String(row[4]);
          if (v.startsWith('http')) imgMarca = v;
          else {
            const match = v.match(/\/d\/([a-zA-Z0-9-_]+)/) || v.match(/id=([a-zA-Z0-9-_]+)/);
            if (match) imgMarca = `https://drive.google.com/uc?export=view&id=${match[1]}`;
          }
        }
        if (imgMarca && imgMarca.includes('drive.google.com')) imgMarca = `https://images.weserv.nl/?url=${encodeURIComponent(imgMarca)}`;

        const skuStr = String(sku);
        const nextArrival = allIncoming
            .filter(i => {
                const d = this._parseDate(i.date);
                return i.sku === skuStr && d && d > new Date();
            })
            .sort((a,b) => new Date(a.date) - new Date(b.date))[0];

        // ✅ Regra: AK é principal, mas se vier vazio ou #N/A cai pra E
        const ak = row[1];
        const e = row[3];
        const descricaoPrincipal = !_isBadCell(ak) ? String(ak) : (!_isBadCell(e) ? String(e) : '');
        const descricaoTecnica = row[2] || '';

        return {
          sku: sku,
          // ✅ novo padrão
          descricaoPrincipal,
          descricaoTecnica,
          // ✅ compatibilidade com o restante do app
          descricao: descricaoPrincipal,
          estoque: Number(row[5]) || 0,
          peso: Number(row[6]) || 0,
          precoH: Number(row[7]) || 0,
          imagem: img,
          imagemMarca: imgMarca,
          proximaEntrada: nextArrival || null
        };
      }).filter(Boolean);

      this._setCache(cacheKey, products);
      return products;
    } catch (e) {
      console.error('Products fetch error', e);
      return [];
    }
  },

  // ✅ Compatibilidade: versão antiga do VendedorDashboard chama fetchProducts()
  async fetchProducts(role, key) {
    return this.getProducts(role, key);
  },

  async getClients() {
    const cacheKey = `${CACHE_PREFIX}clients`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    // Normal caching
    const query = 'SELECT A, B, C, D, E, F';
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CLIENTS_SHEET)}&tq=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url);
      const text = await res.text();
      const rows = this._parseGvizResponse(text);
      
      const clients = rows.map(row => {
        return {
            rota: row[0],
            cnpj: row[1],
            nome: row[2],
            endereco: row[3],
            municipio: row[4],
            uf: row[5]
        };
      }).filter(c => c.nome && c.nome !== 'NOME FANTASIA');

      this._setCache(cacheKey, clients);
      return clients;
    } catch (e) { return []; }
  },

  async getRouteDefinitions() {
    // Task 1: Force fresh data - Skip _getCache logic or rely on timestamped URL
    // We explicitly SKIP the local cache check to force a fresh fetch from Google Sheets
    // const cacheKey = `${CACHE_PREFIX}routes_definitions_v14`; 
    // const cached = this._getCache(cacheKey);
    // if (cached) return cached;

    // Fetch Columns A, B, C, D
    // A = Descricao (Rota)
    // B = Municipios
    // C = Dias de Entrega (CRITICAL: This is index 2)
    // D = Corte
    const query = 'SELECT A, B, C, D';
    // Task 1: Add timestamp and headers for route-specific cache busting
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(ROUTES_SHEET)}&tq=${encodeURIComponent(query)}&_t=${Date.now()}`;

    try {
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      const text = await res.text();
      const rows = this._parseGvizResponse(text);
      
      const routesList = [];
      
      rows.forEach(row => {
          const rotaName = row[0];
          const cidade = row[1];
          const diasText = row[2]; // Column C
          const cutoffText = row[3]; // Column D
          
          if (cidade) {
              routesList.push({
                  id: rotaName,
                  city: cidade.trim(),
                  daysText: diasText,
                  parsedDays: this._parseDeliveryDays(diasText),
                  cutoff: cutoffText ? String(cutoffText).replace('h', '').trim() : '17:30'
              });
          }
      });

      // Optionally set cache, but since we are forcing fresh, it might not be read often.
      // Keeping it for consistency if we revert force-fetch later.
      const cacheKey = `${CACHE_PREFIX}routes_definitions_fresh`;
      this._setCache(cacheKey, routesList);
      return routesList;
    } catch (e) { return []; }
  },

  async getNextDeliveryDates(routeName, count = 7, municipality = null) {
      console.log('--- [DEBUG] START getNextDeliveryDates ---');
      console.log(`[DEBUG] Input -> Municipality: "${municipality}", RouteName: "${routeName}"`);

      const routes = await this.getRouteDefinitions();
      let allowedDays = new Set();
      let cutoffHour = 17;
      let cutoffMinute = 30;

      // Logic Update: Search for ALL matching route definitions for this city
      if (municipality) {
          const matchingRoutes = routes.filter(r => 
              r.city && r.city.toLowerCase().trim() === municipality.toLowerCase().trim()
          );

          console.log(`[DEBUG] Found ${matchingRoutes.length} matching routes for "${municipality}":`);
          matchingRoutes.forEach(r => {
             console.log(`   > Route: "${r.id}"`);
             console.log(`   > Raw Days (Col C): "${r.daysText}"`);
             console.log(`   > Parsed Days: [${r.parsedDays.join(', ')}]`);
          });

          if (matchingRoutes.length > 0) {
              // Merge days from all matching routes
              matchingRoutes.forEach(r => {
                  r.parsedDays.forEach(day => allowedDays.add(day));
              });

              // Use cutoff from the first valid match
              if (matchingRoutes[0].cutoff) {
                  const [h, m] = matchingRoutes[0].cutoff.split(':').map(Number);
                  if (!isNaN(h)) cutoffHour = h;
                  if (!isNaN(m)) cutoffMinute = m;
              }
          }
      }

      // Fallback: search by routeName
      if (allowedDays.size === 0 && routeName) {
           console.log(`[DEBUG] No municipality match (or not provided). Searching by RouteName: "${routeName}"`);
           const matchedRoute = routes.find(r => 
              r.id && (String(r.id) === String(routeName) || String(r.id).includes(routeName))
          );
          
          if (matchedRoute) {
              console.log(`   > Found Route by ID: "${matchedRoute.id}"`);
              console.log(`   > Raw Days: "${matchedRoute.daysText}"`);
              console.log(`   > Parsed Days: [${matchedRoute.parsedDays.join(', ')}]`);

              matchedRoute.parsedDays.forEach(day => allowedDays.add(day));
              if (matchedRoute.cutoff) {
                  const [h, m] = matchedRoute.cutoff.split(':').map(Number);
                  if (!isNaN(h)) cutoffHour = h;
                  if (!isNaN(m)) cutoffMinute = m;
              }
          }
      }

      // Default to Mon-Fri if no days found
      let allowedDaysArray = allowedDays.size > 0 ? Array.from(allowedDays) : [1, 2, 3, 4, 5];
      allowedDaysArray.sort((a, b) => a - b);
      
      console.log(`[DEBUG] FINAL ALLOWED DAYS (0=Sun...6=Sat): [${allowedDaysArray.join(', ')}]`);

      const dates = [];
      const now = new Date();
      
      // Log current status
      const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      console.log(`[DEBUG] Current Date: ${now.toLocaleString()} (${daysOfWeek[now.getDay()]})`);
      console.log(`[DEBUG] Cutoff Time: ${cutoffHour}:${cutoffMinute}`);
      
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const cutoffPassed = (currentHour > cutoffHour) || (currentHour === cutoffHour && currentMinute >= cutoffMinute);
      console.log(`[DEBUG] Cutoff Passed? ${cutoffPassed}`);

      let current = new Date(now);
      
      console.log('[DEBUG] Starting Date Loop...');
      let loopCount = 0;
      while (dates.length < count) {
         loopCount++;
         if (loopCount > 30) break; // Safety break

         const day = current.getDay();
         const isToday = current.toDateString() === now.toDateString();
         const dayName = daysOfWeek[day];
         const dateStr = current.toLocaleDateString();

         let isValid = false;
         let reason = "";

         if (allowedDaysArray.includes(day)) {
             if (isToday) {
                 if (!cutoffPassed) {
                     isValid = true;
                     reason = "Today (Before Cutoff)";
                 } else {
                     reason = "Today (After Cutoff)";
                 }
             } else {
                 isValid = true;
                 reason = "Future Allowed Day";
             }
         } else {
             reason = "Day Not Allowed";
         }

         // console.log(`   Checking ${dateStr} (${dayName}) -> ${isValid ? 'VALID' : 'INVALID'} [${reason}]`);

         if (isValid) {
             dates.push(new Date(current));
             console.log(`   >>> Added: ${dateStr} (${dayName})`);
         }

         current.setDate(current.getDate() + 1);
         if (dates.length === 0 && (current - now) > 60 * 24 * 60 * 60 * 1000) break;
      }

      console.log(`[DEBUG] Returning ${dates.length} dates.`);
      console.log('--- [DEBUG] END getNextDeliveryDates ---');
      return dates;
  },

  calculateLineItem(product, quantity) {
    const sku = Number(product.sku);
    const pricePerKg = product.precoH || 0;
    const pesoMedio = product.peso || 0;
    
    const fmtMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const fmtWeight = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val);

    if (sku >= 400000 && sku < 410000) {
      const totalWeight = quantity * pesoMedio;
      const total = totalWeight * pricePerKg;
      return {
        total: total,
        unit: 'UND',
        displayString: `${quantity} UND x ${fmtWeight(pesoMedio)} KG x ${fmtMoney(pricePerKg)} = ${fmtMoney(total)}`
      };
    }

    if (sku >= 410000) {
      const boxWeight = 10;
      const total = quantity * boxWeight * pricePerKg;
      return {
        total: total,
        unit: 'CX',
        displayString: `${quantity} CX x ${fmtWeight(boxWeight)} KG x ${fmtMoney(pricePerKg)} = ${fmtMoney(total)}`
      };
    }

    const basicTotal = (product.precoH || 0) * quantity;
    return {
      total: basicTotal,
      unit: 'UN',
      displayString: `${quantity} UN x ${fmtMoney(product.precoH)} = ${fmtMoney(basicTotal)}`
    };
  }
};
