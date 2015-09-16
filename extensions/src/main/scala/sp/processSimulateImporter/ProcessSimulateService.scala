package sp.processSimulateImporter

import akka.actor._
import sp.domain.logic.{ActionParser, PropositionParser}
import sp.system.ServiceSupport
import sp.system.messages._
import sp.domain._
import sp.domain.Logic._
import akka.pattern.ask
import akka.util.Timeout
import scala.concurrent.{Promise, Future, Await}
import scala.concurrent.duration._
import akka.actor.{ Actor, ActorRef, Props, ActorSystem }
import akka.camel.{ CamelExtension, CamelMessage, Consumer, Producer }

import scala.util.Try

/**
 * Some unclear interfaces. What is items?
 */
object ProcessSimulateService {
  val specification = SPAttributes(
    "service" -> SPAttributes(
      "group"-> "External"
    ),
    "command" -> KeyDefinition("String", List("createOp", "import", "import_single"), Some("createOp")),
    "params" -> SPAttributes(
      "items" -> KeyDefinition("SPAttributes", List(), Some(org.json4s.JArray(List())))
    )
  )

  // Om du vill att den skall skapa en actor per request så skriver du såhär
  //def props = sp.system.ServiceLauncher.props(Props(classOf[ProcessSimulateService]))

  // Nu skapas endast en service, enl nedan, då activeMQ ju är tung. Men jag tycker vi skall
  // lägga den i en egen så att vi har en service som kallas activeMQ som man skickar till
  def props(modelHandler: ActorRef, psAmq: ActorRef) = Props(classOf[ProcessSimulateService], modelHandler, psAmq)
}

object ProcessSimulateAMQ {
  def props = Props(classOf[ProcessSimulateAMQ])
}

// activemq part    Beövs det inte en consumer också?
class ProcessSimulateAMQ extends Actor with Producer {
  implicit val timeout = Timeout(1 seconds)
  def endpointUri = "activemq:PS"
}



class ProcessSimulateService(modelHandler: ActorRef, psAmq: ActorRef) extends Actor  with ServiceSupport {
  implicit val timeout = Timeout(5 seconds)

  import context.dispatcher

  def addObjectFromJSON(json: String, modelid: ID) = {
    for {
      value <- SPValue.fromJson(json)
      idable <- value.to[IDAble]
    } yield modelHandler ! UpdateIDs(modelid, List(idable))

  }

  def receive = {
    case r@Request(service, attr, ids, reqID) => {
      val replyTo = sender()
      implicit val requestNReplyTo = (r, replyTo)
      val progress = context.actorOf(progressHandler)

      progress ! SPAttributes("progress" -> "creating a json for Process simulate")

      for {
        command <- getAttr(_.getAs[String]("command"))
        model <- getAttr(_.getAs[ID]("model"))
        params <- getAttr(_.getAs[SPAttributes]("params"))
      } yield {
          val res = command match {
            case "createOp" => createOp(model, params, ids, progress)
            case "import" => fetch(model, params, ids, progress)
            case "import_single" => fetch_single(model, params, ids, progress)
          }
        }

      progress ! PoisonPill
      for {

      }
    }
    case _ => sender ! SPError("Ill formed request");
  }

  def createOp(model: ID, params: SPAttributes, ids: List[IDAble], progress: ActorRef)(implicit rnr: (Request, ActorRef)) = {
    // lite oklart här. Vad gör raden? hur ser datastrukturen ut i params? Bör definieras i en case class
    val checkItems = params.findObjectsWithField(List(("checked", SPValue(true)))).unzip._1.flatMap(ID.makeID)
    val sopSpecs = ids.filter(item => item.isInstanceOf[SOPSpec] && checkItems.contains(item.id)).map(_.asInstanceOf[SOPSpec])
    val opIDS = for {
      spec <- sopSpecs
      sop <- spec.sop
      op <- sp.domain.logic.SOPLogic.getAllOperations(sop)
    } yield op

    val ops = ids.filter(item => opIDS.contains(item.id)) map (_.asInstanceOf[Operation])
    val json = SPAttributes(
      "command" -> "create_op_chain",
      "params" -> SPAttributes(
        "ops" -> ops.map { o =>
          SPAttributes(
            "name" -> o.name,
            "simop" -> o.attributes.getAs[String]("simop").
              orElse(o.attributes.getAs[String]("simop")).getOrElse("dummy")
          )
        },
        "parent" -> "ingenParentFördig")).toJson

    // Så det är ett meddelande per SOPSpec eller?
    // TODO: progressbar while waiting for answer...
    val ask = psAmq ? json

    progress ! SPAttributes("progress" -> "Message send to PS. Waiting for answer")

    val items = handlePSAnswer(ask)

    items.map{list => Response(list, SPAttributes("command" -> "create_op_chain"), rnr._1.service, rnr._1.reqID)}

  }

  def fetch(model: ID, params: SPAttributes, ids: List[IDAble], progress: ActorRef)(implicit rnr: (Request, ActorRef)) = {
    val json = SPAttributes("command" -> "get_all_tx_objects") toJson

    val ask = psAmq ? json
    progress ! SPAttributes("progress" -> "Message send to PS. Waiting for answer")

    val items = handlePSAnswer(ask)
    items.map{list => Response(list, SPAttributes("command" -> "get_all_tx_objects"), rnr._1.service, rnr._1.reqID)}


  }

  def fetch_single(model: ID, params: SPAttributes, ids: List[IDAble], progress: ActorRef)(implicit rnr: (Request, ActorRef)) = {

    val txid = params.getAs[String]("txid").getOrElse("")

    val json = SPAttributes("command" -> "get_tx_object", "params" -> Map("txid" -> txid)) toJson
    val ask = psAmq ? json
    progress ! SPAttributes("progress" -> "Message send to PS. Waiting for answer")

    val items = handlePSAnswer(ask)
    items.map{list => Response(list, SPAttributes("command" -> "get_all_tx_objects"), rnr._1.service, rnr._1.reqID)}



  }

  def handlePSAnswer(f: Future[Any])(implicit rnr: (Request, ActorRef)): Future[List[IDAble]] = {
    val p = Promise[List[IDAble]]()

    // finds error by exception
    val res: Future[List[IDAble]] = f.map{answer =>
      val json = answer.asInstanceOf[CamelMessage].body.toString
      val value = SPValue.fromJson(json).get
      val list = value.to[List[IDAble]]
      val item = value.to[IDAble].map(List(_))

      list.getOrElse(item.get)
    }

    res.map(p.success(_))
    res.onFailure{case x => {
      p.failure(x)
      rnr._2 ! SPError(s"Failed when communicating with Process simulate: $x")
    }}

    p.future
  }

}



//
//      val reply = sender
//      extract(attr) match {
//        case Some(("createOp",model,params)) => {
//
//          val checkedItems = params.getAs[JObject]("items") match {
//            case Some(list) => list.findObjectsWithField(List(("checked", JBool(true)))).unzip._1.flatMap(ID.makeID)
//            case _ => List()
//          }
//
//          val spids = Await.result(modelHandler ? GetSpecs(model, s => checkedItems.contains(s.id) && s.isInstanceOf[SOPSpec]),timeout.duration)
//          spids match {
//            case SPIDs(items) => {
//              for(item <- items) {
//                val ops = item match {
//                  case SOPSpec(name, s, attributes, id) => {
//                    val ids = s.head.sop.map(x=>x match {
//                      case h: Hierarchy => h.operation
//                    } )
//                    val objects = Await.result(modelHandler ? GetIds(model, ids.toList),timeout.duration)
//                    objects match {
//                      case SPIDs(ops) => ops
//                    }
//                  }
//                }
//
//                val json = SPAttributes("command"->"create_op_chain",
//                  "params"->Map("ops" -> ops.map(o=>
//                    SPAttributes("name" -> o.name,"simop" -> (o.attributes.getAs[String]("simop") match {
//                      case Some(txid) => txid
//                      case _ => (o.attributes.getAs[String]("txid") match {
//                        case Some(txid) => txid
//                        case _ => "dummy"
//                      })
//                    }))), "parent" -> item.name)) toJson
//
//                // TODO: progressbar while waiting for answer...
//                psAmq ! json
//
//                // val result = Await.result(psAmq ? json, timeout.duration)
//                // val children = result match {
//                //   case CamelMessage(body,headers) => read[List[IDAble]](body.toString)
//                // }
//              }
//            }
//          }
//
//
//          reply ! "all ok"
//        }
//
//      // Lite oklart vad som händer här
//        case Some(("import",model,params)) => {
//          val json = SPAttributes("command"->"get_all_tx_objects") toJson
//          val result = Await.result(psAmq ? json, timeout.duration)
//          result match {
//            case CamelMessage(body,headers) => {
//              val idables = read[List[IDAble]](body.toString)
//              modelHandler ! UpdateIDs(model, idables)
//            }
//          }
//          reply ! "all ok"
//        }
//
//        case Some(("import_single",model,params)) => {
//          val txid = params.getAs[String]("txid") match {
//            case Some(s) => s
//            case _ => ""
//          }
//          val json = SPAttributes("command"->"get_tx_object", "params"->Map("txid"->txid)) toJson
//          val result = Await.result(psAmq ? json, timeout.duration)
//          result match {
//            case CamelMessage(body,headers) => addObjectFromJSON(body.toString, model)
//          }
//          reply ! "all ok"
//        }
//
//
//        case _ => reply ! SPError("Ill formed request");
//      }
//    }
//  }
//
//  def extract(attr: SPAttributes) = {
//    for {
//      command <- attr.getAs[String]("command")
//      model <- attr.getAs[ID]("model")
//      params <- attr.getAs[SPAttributes]("params")
//    } yield (command, model, params)
//  }
//}


