#### [↵ 回上一層](/docs/README.md)
# 插件處理器 (PluginHandler)
繼承EventEmitter類，上限目前設定為100個監聽器。

負責的任務有：  
1. [插件載入](#載入演算法)
2. [監聽所有機器人輸出訊息的事件](#事件列表)

## module.exports

PluginHandler模塊於[Chatbot](../../../src/bot/chatbot.js)對象的建構子中被加載，加載過程中會先建構一個PluginHandler對象，接著將此PluginHandler對象作為Proxy對象建構子的第一個參數，[常數代理](../util/const-proxy.md)對象作為第二個參數，建構並導出此Proxy對象。

## 載入演算法
插件載入的任務在PluginHandler對象建構時被調用。
1. 遍歷[src/plugin](../../../src/plugin)下的所有資料夾，每個目錄都須包含一個[info.cson](../plugin/info.cson.md)，才會被視為合法插件。
2. 依照info.cson中module數組的所有項目作為檔名，與info.cson同目錄下依序加載(每一個被加載的js，稱為此插件的模塊)。
3. 插件的模塊須導出一個包含run()方法的對象，該對象會被註冊到PLUGIN_LIST這個屬性中。其結構如下：
```
//結構示意
PLUGIN_LIST{
  plugin_id: {
    module_name: {
      function run(){}
    }
  }
}

//調用插件run()方法
this[plugin_id][module_name].run()
```

## 啟用插件
在PluginHandler對象中，execAll()方法啟用所有插件，而exec(plugin_id, mod)方法啟動個別插件，藉由plugin_id指定插件識別碼，mod指定模塊名稱。execAll()方法是在Chatbot對象的run()方法中被調用，在調用之前會有個任務以0.5秒為週期執行，確保所有[社群接口(SMI)](../smi/smi.md)準備好之後，才調用run()方法啟動插件。

## 插件訊息推送
插件模塊藉global.bot取得Chatbot對象(或是繼承Chabot類之對象)，調用Chatbot對象之output(event, callback)方法推送訊息至社群接口，output(event, callback)方法實際上是藉Chatbot對象在PluginHandler對象上註冊監聽器。output(event, callback)方法第一個參數event之相關事件見[事件列表](#事件列表)，第二個參數callback所接到的訊息格式見[訊息格式](#訊息格式)

## 事件列表
| 事件 | 說明|
| :---: | :---:|
|`message.broadcast`|供插件使用之推播訊息，所有社群接口皆須監聽該事件<br>[<格式>](#訊息格式)|
|||
|`message.<smi_id>`<br>`message.<smi_id>.<keyword>`|供插件使用之定向訊息，由`<smi_id>`指定推送訊息的目標社群接口，用`<keyword>`指定目標社群接口下的子接口|
|`message.cq-bot.group`|推送至酷Q接口的群組訊息，群組ID由監聽器的回調函數之參數傳遞<br>[<格式>](#訊息格式)|


## 訊息格式
`message.broadcast`
```
{
  src: {
    id: plugin_id,
    mod: mod_name
  },
  msg: <string>,
}
```
`message.cq-bot.group`
```
{
  src: {
    id: plugin_id,
    mod: mod_name
  },
  gid: QQ_group_id
  msg: <string>,
}
```
## TODO
- [x] 載入插件及模塊
- [ ] 註冊插件之info.cson內容，並提供接口給插件調用
