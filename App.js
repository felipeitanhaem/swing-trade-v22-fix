import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, TextInput, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [firebaseUrl, setFirebaseUrl] = useState('https://swingtrade-8bda4-default-rtdb.firebaseio.com');
  const [savedUrl, setSavedUrl] = useState(null);
  const [trades, setTrades] = useState([]);
  const [totalAtual, setTotalAtual] = useState(0);
  const [totalInvestido, setTotalInvestido] = useState(0);
  const [lucroTotal, setLucroTotal] = useState(0);
  const [timestamp, setTimestamp] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const intervalRef = useRef(null);
  const lastDadosRef = useRef('');

  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [tempChatId, setTempChatId] = useState('');

  const [showCompraModal, setShowCompraModal] = useState(false);
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [showFecharModal, setShowFecharModal] = useState(false);
  const [formAcao, setFormAcao] = useState('');
  const [formFecharTicker, setFormFecharTicker] = useState('');
  const [formFecharPreco, setFormFecharPreco] = useState('');
  const [formQtd, setFormQtd] = useState('');
  const [formValor, setFormValor] = useState('');

  useEffect(() => {
    init();
    const demo = parseLista("VALE3 100 78.0 78.95 C 650.20; VALEU771 500 0.75 0.62 V 0.00");
    if(demo.length>0){
      setTrades(demo);
      setTotalInvestido(demo.reduce((s,t)=>s+t.qtd*t.entrada,0));
      setTotalAtual(demo.reduce((s,t)=>s+t.qtd*t.atual,0));
      setLucroTotal(demo.reduce((s,t)=>s+calcLucro(t),0));
      setTimestamp(new Date().toLocaleString('pt-BR'));
    }
    return () => clearInterval(intervalRef.current);
  }, []);

  const init = async () => {
    try{
      const url = await AsyncStorage.getItem('FIREBASE_URL');
      const token = await AsyncStorage.getItem('TELEGRAM_TOKEN');
      const chatId = await AsyncStorage.getItem('TELEGRAM_CHAT_ID');
      if(url){
        setSavedUrl(url);
        setFirebaseUrl(url);
        setTempUrl(url);
        startPolling(url);
      }
      if(token){
        setTelegramToken(token);
        setTempToken(token);
      }
      if(chatId){
        setTelegramChatId(chatId);
        setTempChatId(chatId);
      }
    }catch(e){ console.log(e); }
  };

  const saveConfig = async () => {
    try{
      const url = (tempUrl || firebaseUrl).trim().replace(/\/$/, '');
      const tkn = tempToken.trim();
      const chat = tempChatId.trim();
      if(!tkn || !chat){
        Alert.alert('Telegram obrigatório', 'Preencha Bot Token e Chat ID. Sem isso não envia /op nem /fim');
        return;
      }
      if(url && !url.includes('firebaseio.com') && !url.includes('firebasedatabase')){
        Alert.alert('URL Firebase inválida', 'URL deve ser tipo: https://SEU-PROJETO.firebaseio.com');
        return;
      }
      
      await AsyncStorage.setItem('FIREBASE_URL', url);
      await AsyncStorage.setItem('TELEGRAM_TOKEN', tkn);
      await AsyncStorage.setItem('TELEGRAM_CHAT_ID', chat);
      
      setSavedUrl(url);
      setFirebaseUrl(url);
      setTelegramToken(tkn);
      setTelegramChatId(chat);
      
      setShowConfig(false);
      // Testa telegram automaticamente após salvar
      try{
        const testUrl = `https://api.telegram.org/bot${tkn}/sendMessage`;
        await fetch(testUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text: '✅ Bot conectado! Teste OK' })
        });
      }catch(e){}
      Alert.alert('✅ Salvo', `Firebase: ${url ? 'OK' : 'vazio'}\nTelegram Token: ${tkn ? 'OK ('+tkn.substring(0,10)+'...)' : 'vazio'}\nChat ID: ${chat || 'vazio'}\n\nSe deu erro de "Not Found", verifique se o bot está no grupo.`);
      if(url) startPolling(url);
    }catch(e){
      Alert.alert('Erro ao salvar', e.message);
    }
  };

  const parseLista = (msg) => {
    try{
      const items = msg.trim().split(';');
      const res=[];
      for(let s of items){
        const p=s.trim().toUpperCase().replace(/,/g,'.').split(/\s+/);
        if(p.length<4) continue;
        const ticker=p[0];
        const qtd=parseInt(p[1]);
        const entrada=parseFloat(p[2]);
        const atual=parseFloat(p[3]);
        let tipo='C';
        let lucroMax=0;
        if(p.length>=5){
          if(p[4]==='V'||p[4]==='C'){ tipo=p[4]; if(p.length>=6) lucroMax=parseFloat(p[5])||0; }
          else { lucroMax=parseFloat(p[4])||0; }
        }
        if(isNaN(qtd)||isNaN(entrada)||isNaN(atual)) continue;
        res.push({ticker,qtd,entrada,atual,tipo,lucroMax});
      }
      return res;
    }catch(e){ return []; }
  };

  const calcLucro = (item) => item.tipo==='V' ? (item.entrada-item.atual)*item.qtd : (item.atual-item.entrada)*item.qtd;

  const startPolling = (baseUrl) => {
    clearInterval(intervalRef.current);
    const finalUrl = baseUrl.replace(/\/$/, '') + '/carteira.json';
    const poll = async () => {
      try{
        const r = await fetch(finalUrl + '?t=' + Date.now(), {cache:'no-store'});
        const data = await r.json();
        if(data && data.dados && data.dados !== lastDadosRef.current){
          lastDadosRef.current = data.dados;
          const lista = parseLista(data.dados);
          if(lista.length>0){
            setTrades(lista);
            setTotalInvestido(lista.reduce((s,t)=>s+t.qtd*t.entrada,0));
            setTotalAtual(lista.reduce((s,t)=>s+t.qtd*t.atual,0));
            setLucroTotal(lista.reduce((s,t)=>s+calcLucro(t),0));
            setTimestamp(data.timestamp ? new Date(data.timestamp).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'));
          }
        }
      }catch(e){}
    };
    poll();
    intervalRef.current = setInterval(poll,3000);
  };

  const enviarTelegram = async (mensagem) => {
    if(!telegramToken || !telegramChatId){
      Alert.alert('❌ Telegram não configurado', `Token: ${telegramToken ? 'OK' : 'FALTANDO'}\nChat ID: ${telegramChatId ? 'OK' : 'FALTANDO'}\n\nVá em ⚙️ e configure.`);
      return false;
    }
    try{
      const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChatId, text: mensagem })
      });
      const data = await resp.json();
      if(data.ok){ return true; }
      else {
        console.log('Telegram erro:', data);
        let msg = data.description || 'Erro desconhecido';
        if(msg.includes('Not Found') || msg.includes('not found')){
          msg = 'Bot TOKEN inválido ou Chat ID não encontrado. Verifique:\n1. Token está correto (do @BotFather)\n2. Bot foi adicionado no grupo/canal\n3. Chat ID está correto (ex: -1001234567890)';
        }
        Alert.alert('❌ Erro Telegram', msg + `\n\nDetalhe: ${data.description}`);
        return false;
      }
    }catch(e){
      console.log('Telegram exception:', e);
      Alert.alert('❌ Erro de rede', e.message + '\n\nVerifique internet e se o bot existe');
      return false;
    }
  };

  const handleFechar = async () => {
    if(!formFecharTicker.trim() || !formFecharPreco.trim()){
      Alert.alert('Preencha o preço');
      return;
    }
    const ticker = formFecharTicker.trim().toUpperCase();
    const preco = formFecharPreco.trim().replace(',', '.');
    const mensagem = `/fim ${ticker} ${preco}`;
    const ok = await enviarTelegram(mensagem);
    if(ok){
      setShowFecharModal(false);
      setFormFecharTicker('');
      setFormFecharPreco('');
      Alert.alert('✅ Fechado!', mensagem);
    }
  };

  const abrirFechar = (ticker) => {
    setFormFecharTicker(ticker);
    setFormFecharPreco('');
    setShowFecharModal(true);
  };

  const handleOperacao = async (tipo) => {
    if(!formAcao.trim() || !formQtd.trim() || !formValor.trim()){
      Alert.alert('Preencha todos os campos');
      return;
    }
    const acao = formAcao.trim().toUpperCase();
    const qtd = formQtd.trim();
    const valor = formValor.trim().replace(',', '.');
    const mensagem = `/op ${acao} ${qtd} ${valor} ${tipo}`;
    const ok = await enviarTelegram(mensagem);
    if(ok){
      setShowCompraModal(false);
      setShowVendaModal(false);
      setFormAcao(''); setFormQtd(''); setFormValor('');
      Alert.alert('✅ Enviado!', mensagem);
    }
  };

  const renderItem = ({item}) => {
    const lucro = calcLucro(item);
    const perc = item.entrada!==0 ? (lucro/(item.entrada*Math.abs(item.qtd)))*100 : 0;
    const isV = item.tipo==='V';
    const isLucro = lucro>=0;
    const showTag = item.lucroMax>0 && lucro < (item.lucroMax * 0.75);
    const queda = item.lucroMax>0 ? ((item.lucroMax - lucro)/item.lucroMax*100) : 0;
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.fecharX} onPress={()=>abrirFechar(item.ticker)}>
          <Text style={styles.fecharXText}>✕</Text>
        </TouchableOpacity>
        <View style={[styles.icon, {backgroundColor: isV ? '#FF9500' : '#1A9A8C'}]}><Text style={styles.iconText}>{isV ? '↘' : '↗'}</Text></View>
        <View style={{flex:1}}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <Text style={styles.ticker}>{item.ticker}</Text>
            <View style={[styles.badge, {backgroundColor: isV ? '#FF9500' : '#2BB2A6'}]}><Text style={styles.badgeText}>{item.tipo}</Text></View>
          </View>
          <Text style={styles.qtd}>{item.qtd} Qtd • {isV?'Vendido':'Comprado'} R$ {item.entrada.toFixed(2)} → R$ {item.atual.toFixed(2)}</Text>
          <View style={{flexDirection:'row', alignItems:'center', marginTop:2}}>
            <Text style={styles.lucroMax}>lucro Max R$ {item.lucroMax.toFixed(2).replace('.',',')}</Text>
            {showTag ? <View style={styles.tag}><Text style={styles.tagText}>↓ -{queda.toFixed(0)}%</Text></View> : null}
          </View>
        </View>
        <View style={{alignItems:'flex-end'}}>
          <Text style={styles.total}>R$ {(item.qtd*item.atual).toFixed(2).replace('.',',')}</Text>
          <Text style={[styles.lucro, {color: isLucro ? '#30D158' : '#FF3B30'}]}>{isLucro?'↗ ▲':'↘ ▼'} R$ {Math.abs(lucro).toFixed(2).replace('.',',')}</Text>
          <Text style={[styles.perc, {color: isLucro ? '#30D158' : '#FF3B30'}]}>({perc>=0?'+':''}{perc.toFixed(2).replace('.',',')}%)</Text>
        </View>
      </View>
    );
  };

  const percTotal = totalInvestido!==0 ? (lucroTotal/totalInvestido)*100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Swing Trade</Text>
        <View style={{flexDirection:'row', alignItems:'center'}}>
          <View style={styles.ao}><View style={styles.dot}/><Text style={styles.aoText}>AO VIVO</Text></View>
          <TouchableOpacity style={styles.gear} onPress={()=>{
            setTempUrl(savedUrl || firebaseUrl);
            setTempToken(telegramToken);
            setTempChatId(telegramChatId);
            setShowConfig(true);
          }}><Text>⚙️</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.label}>Total da Carteira</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>Total Atual</Text><Text style={styles.big}>R$ {totalAtual.toFixed(2).replace('.',',')}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Investido</Text><Text style={styles.mid}>R$ {totalInvestido.toFixed(2).replace('.',',')}</Text></View>
        <View style={styles.botoesOpRow}>
          <TouchableOpacity style={[styles.btnOp, styles.btnCompra]} onPress={()=>{ setFormAcao(''); setFormQtd(''); setFormValor(''); setShowCompraModal(true); }}><Text style={styles.btnOpText}>COMPRA</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btnOp, styles.btnVenda]} onPress={()=>{ setFormAcao(''); setFormQtd(''); setFormValor(''); setShowVendaModal(true); }}><Text style={styles.btnOpText}>VENDA</Text></TouchableOpacity>
        </View>
        <View style={styles.divider}/>
        <View style={styles.row}><Text style={styles.rowLabel}>Lucro / Prejuízo</Text><Text style={[styles.lucroTotal, {color: lucroTotal>=0 ? '#30D158' : '#FF3B30'}]}>{lucroTotal>=0?'+':''}R$ {lucroTotal.toFixed(2).replace('.',',')} ({percTotal>=0?'+':''}{percTotal.toFixed(2).replace('.',',')}%)</Text></View>
        <Text style={styles.time}>{timestamp} {savedUrl ? '• Firebase OK' : ''} {telegramToken ? '• Telegram OK' : ''}</Text>
      </View>
      <FlatList data={trades} keyExtractor={(i,idx)=>i.ticker+idx} renderItem={renderItem} />
      <Text style={styles.formato}>TAG laranja se lucro atual 25% menor que Max</Text>
      
      <Modal visible={showConfig} transparent animationType="slide">
        <View style={styles.modalBg}><ScrollView contentContainerStyle={{flexGrow:1, justifyContent:'center'}}><View style={styles.modalBox}>
          <Text style={styles.modalTitle}>⚙️ Configurar</Text>
          
          <Text style={styles.sectionLabel}>🔥 Firebase URL</Text>
          <TextInput style={styles.input} value={tempUrl} onChangeText={setTempUrl} placeholder="https://swingtrade-xxxx.firebaseio.com" autoCapitalize="none" autoCorrect={false} />
          
          <Text style={styles.sectionLabel}>🤖 Telegram Bot Token</Text>
          <TextInput style={styles.input} value={tempToken} onChangeText={setTempToken} placeholder="1234567890:AAH..." autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.helpText}>Pegue no @BotFather</Text>
          
          <Text style={styles.sectionLabel}>💬 Chat ID</Text>
          <TextInput style={styles.input} value={tempChatId} onChangeText={setTempChatId} placeholder="-1001234567890" autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.helpText}>Grupo/canal: encaminhe msg para @userinfobot</Text>
          
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>Firebase: {tempUrl ? '✅' : '❌'}</Text>
            <Text style={styles.statusText}>Token: {tempToken ? '✅' : '❌'}</Text>
            <Text style={styles.statusText}>Chat ID: {tempChatId ? '✅' : '❌'}</Text>
          </View>
          
          <TouchableOpacity style={[styles.btn, {backgroundColor:'#1A9A8C'}]} onPress={saveConfig}><Text style={styles.btnText}>💾 Salvar Tudo</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, {backgroundColor:'#F2F2F7'}]} onPress={()=>setShowConfig(false)}><Text style={[styles.btnText,{color:'#333'}]}>Cancelar</Text></TouchableOpacity>
        </View></ScrollView></View>
      </Modal>

      <Modal visible={showCompraModal} transparent animationType="slide">
        <View style={styles.modalBg}><View style={styles.modalBox}>
          <Text style={styles.modalTitle}>🟢 Nova Compra</Text>
          <Text style={styles.inputLabel}>Nome da Ação</Text>
          <TextInput style={styles.input} value={formAcao} onChangeText={setFormAcao} placeholder="Ex: PETR4" autoCapitalize="characters" />
          <Text style={styles.inputLabel}>Quantidade</Text>
          <TextInput style={styles.input} value={formQtd} onChangeText={setFormQtd} placeholder="Ex: 100" keyboardType="numeric" />
          <Text style={styles.inputLabel}>Valor Pago</Text>
          <TextInput style={styles.input} value={formValor} onChangeText={setFormValor} placeholder="Ex: 42.5" keyboardType="decimal-pad" />
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Vai enviar:</Text>
            <Text style={styles.previewText}>/op {formAcao.toUpperCase() || 'PETR4'} {formQtd || '100'} {formValor.replace(',','.') || '42.5'} compra</Text>
          </View>
          <View style={{flexDirection:'row', gap:12, marginTop:16}}>
            <TouchableOpacity style={[styles.btn, {backgroundColor:'#F2F2F7', flex:1}]} onPress={()=>setShowCompraModal(false)}><Text style={[styles.btnText,{color:'#333'}]}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, {backgroundColor:'#30D158', flex:1}]} onPress={()=>handleOperacao('compra')}><Text style={styles.btnText}>OK - Enviar</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={showVendaModal} transparent animationType="slide">
        <View style={styles.modalBg}><View style={styles.modalBox}>
          <Text style={styles.modalTitle}>🔴 Nova Venda</Text>
          <Text style={styles.inputLabel}>Nome da Ação</Text>
          <TextInput style={styles.input} value={formAcao} onChangeText={setFormAcao} placeholder="Ex: PETR4" autoCapitalize="characters" />
          <Text style={styles.inputLabel}>Quantidade</Text>
          <TextInput style={styles.input} value={formQtd} onChangeText={setFormQtd} placeholder="Ex: 100" keyboardType="numeric" />
          <Text style={styles.inputLabel}>Valor Pago</Text>
          <TextInput style={styles.input} value={formValor} onChangeText={setFormValor} placeholder="Ex: 42.5" keyboardType="decimal-pad" />
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Vai enviar:</Text>
            <Text style={styles.previewText}>/op {formAcao.toUpperCase() || 'PETR4'} {formQtd || '100'} {formValor.replace(',','.') || '42.5'} venda</Text>
          </View>
          <View style={{flexDirection:'row', gap:12, marginTop:16}}>
            <TouchableOpacity style={[styles.btn, {backgroundColor:'#F2F2F7', flex:1}]} onPress={()=>setShowVendaModal(false)}><Text style={[styles.btnText,{color:'#333'}]}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, {backgroundColor:'#FF3B30', flex:1}]} onPress={()=>handleOperacao('venda')}><Text style={styles.btnText}>OK - Enviar</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={showFecharModal} transparent animationType="slide">
        <View style={styles.modalBg}><View style={styles.modalBox}>
          <Text style={styles.modalTitle}>❌ Fechar Posição</Text>
          <Text style={styles.inputLabel}>Ação</Text>
          <View style={[styles.input, {backgroundColor:'#F2F2F7'}]}><Text style={{fontWeight:'800'}}>{formFecharTicker}</Text></View>
          <Text style={styles.inputLabel}>Preço de Fechamento</Text>
          <TextInput style={styles.input} value={formFecharPreco} onChangeText={setFormFecharPreco} placeholder="Ex: 0.59" keyboardType="decimal-pad" autoFocus />
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Vai enviar:</Text>
            <Text style={styles.previewText}>/fim {formFecharTicker || 'VALEU771'} {formFecharPreco.replace(',','.') || '0.59'}</Text>
          </View>
          <View style={{flexDirection:'row', gap:12, marginTop:16}}>
            <TouchableOpacity style={[styles.btn, {backgroundColor:'#F2F2F7', flex:1}]} onPress={()=>setShowFecharModal(false)}><Text style={[styles.btnText,{color:'#333'}]}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, {backgroundColor:'#FF3B30', flex:1}]} onPress={handleFechar}><Text style={styles.btnText}>OK</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container:{flex:1, backgroundColor:'#fff'},
  header:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16},
  title:{fontSize:22, fontWeight:'800'},
  ao:{flexDirection:'row', alignItems:'center', marginRight:8},
  dot:{width:10, height:10, borderRadius:5, backgroundColor:'#22C55E', marginRight:6},
  aoText:{color:'#16A34A', fontSize:13, fontWeight:'700'},
  gear:{width:36, height:36, borderRadius:18, backgroundColor:'#F2F2F7', justifyContent:'center', alignItems:'center'},
  totalCard:{backgroundColor:'#1C1C1E', borderRadius:24, margin:16, padding:20},
  label:{color:'#8E8E93', fontSize:13},
  row:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:12},
  rowLabel:{color:'#8E8E93', fontSize:15},
  big:{color:'#fff', fontSize:28, fontWeight:'800'},
  mid:{color:'#AEAEB2', fontSize:16},
  divider:{height:1, backgroundColor:'#2C2C2E', marginVertical:16},
  lucroTotal:{fontSize:17, fontWeight:'700'},
  time:{color:'#636366', fontSize:11, textAlign:'right', marginTop:14},
  botoesOpRow:{flexDirection:'row', gap:12, marginTop:16},
  btnOp:{flex:1, paddingVertical:12, borderRadius:12, alignItems:'center'},
  btnCompra:{backgroundColor:'#30D158'},
  btnVenda:{backgroundColor:'#FF3B30'},
  btnOpText:{color:'#fff', fontWeight:'800', fontSize:14},
  card:{backgroundColor:'#F2F2F7', borderRadius:20, marginHorizontal:16, marginBottom:12, padding:16, flexDirection:'row', alignItems:'center'},
  fecharX:{position:'absolute', top:6, right:6, width:26, height:26, borderRadius:13, backgroundColor:'transparent', justifyContent:'center', alignItems:'center', zIndex:5},
  fecharXText:{color:'#FF3B30', fontSize:18, fontWeight:'900'},
  icon:{width:56, height:56, borderRadius:16, justifyContent:'center', alignItems:'center', marginRight:12},
  iconText:{color:'#fff', fontSize:24, fontWeight:'800'},
  ticker:{fontSize:18, fontWeight:'800'},
  badge:{marginLeft:6, paddingHorizontal:6, paddingVertical:2, borderRadius:6},
  badgeText:{color:'#fff', fontSize:11, fontWeight:'700'},
  qtd:{color:'#8E8E93', fontSize:13, marginTop:3},
  lucroMax:{color:'#30D158', fontSize:13, marginTop:2},
  tag:{backgroundColor:'#FF9500', paddingHorizontal:8, paddingVertical:3, borderRadius:999, marginLeft:6},
  tagText:{color:'#fff', fontSize:10, fontWeight:'800'},
  total:{fontSize:17, fontWeight:'800'},
  lucro:{fontSize:13, fontWeight:'700', marginTop:3},
  perc:{fontSize:13, marginTop:2},
  formato:{color:'#AEAEB2', fontSize:11, textAlign:'center', padding:12},
  modalBg:{flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:24},
  modalBox:{backgroundColor:'#fff', borderRadius:24, padding:24},
  modalTitle:{fontSize:18, fontWeight:'800'},
  input:{borderWidth:1, borderColor:'#ddd', borderRadius:12, padding:12, marginTop:6, fontSize:15},
  inputLabel:{fontSize:13, fontWeight:'700', color:'#333', marginTop:12},
  sectionLabel:{fontSize:12, fontWeight:'800', color:'#1A9A8C', marginTop:16, textTransform:'uppercase'},
  helpText:{fontSize:11, color:'#8E8E93', marginTop:4},
  statusBox:{backgroundColor:'#F2F2F7', borderRadius:12, padding:12, marginTop:12},
  statusText:{fontSize:12, fontWeight:'600', marginTop:2},
  btn:{padding:14, borderRadius:12, alignItems:'center', marginTop:12},
  btnText:{color:'#fff', fontWeight:'700'},
  previewBox:{backgroundColor:'#F2F2F7', borderRadius:12, padding:12, marginTop:16},
  previewLabel:{fontSize:11, color:'#8E8E93', fontWeight:'700'},
  previewText:{fontSize:13, fontWeight:'800', color:'#1C1C1E', marginTop:4, fontFamily:'monospace'}
});
