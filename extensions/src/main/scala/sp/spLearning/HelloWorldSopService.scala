package sp.system

import akka.actor._
import sp.domain.logic.IDAbleLogic
import scala.concurrent._
import sp.system.messages._
import sp.domain._
import sp.domain.Logic._


object HelloWorldSopService extends SPService {
  val specification = SPAttributes(
    "service" -> SPAttributes(
      "group"-> "aMenuGroup" // to organize in gui. maybe use "hide" to hide service in gui
    ),
    "setup" -> SPAttributes(
      "onlyOperations" -> KeyDefinition("Boolean", List(), Some(false)),
      "searchMethod" -> KeyDefinition("String", List("theGood", "theBad"), Some("theGood"))
    ),
    "findID" -> KeyDefinition("ID", List(), Some(""))
  )

  val transformTuple  = (
    TransformValue("setup", _.getAs[HelloWorldSopSetup]("setup")),
    TransformValue("findID", _.getAs[ID]("findID"))
  )

  val transformation = transformToList(transformTuple.productIterator.toList)

  // important to incl ServiceLauncher if you want unique actors per request
  def props = ServiceLauncher.props(Props(classOf[HelloWorldSopService]))


  // Alla får även "core" -> ServiceHandlerAttributes

//  case class ServiceHandlerAttributes(model: Option[ID],
//                                      responseToModel: Boolean,
//                                      onlyResponse: Boolean,
//                                      includeIDAbles: List[ID])

}


case class HelloWorldSopSetup(onlyOperations: Boolean, searchMethod: String)

// Add constructor parameters if you need access to modelHandler and ServiceHandler etc
class HelloWorldSopService extends Actor with ServiceSupport {
  import context.dispatcher

  def receive = {
    case r @ Request(service, attr, ids, reqID) => {

      // Always include the following lines. Are used by the helper functions
      val replyTo = sender()
      implicit val rnr = RequestNReply(r, replyTo)

      // include this if you whant to send progress messages. Send attributes to it during calculations
      val progress = context.actorOf(progressHandler)

      println(s"I got: $r")

      val s = transform(HelloWorldSopService.transformTuple._1)
      val id = transform(HelloWorldSopService.transformTuple._2)

      val core = r.attributes.getAs[ServiceHandlerAttributes]("core").get
      println(s"core är även med: $core")

      val ops = ids.filter(item => item.isInstanceOf[Operation])
      println(s"ops: ${ops}")

      // for{
      //   op <- ops
      //   keys <- Set("carrierTrans","resourceTrans")
      //   attr <- op.attributes.get(keys)
      // } yield println(s"attr: ${attr}")

      def createConditionsFromAttributes(op: Operation): Operation = {
        def extractRequiredAttributes(): List[SPAttributes] = {
            for {
              keys <- List("carrierTrans","resourceTrans")
              attribCond <- op.attributes.getAs[SPAttributes](keys)
              if attribCond != None
            } yield attribCond
        }
        def remapAttr(attr: List[SPAttributes]): SPAttributes ={
          import sp.virtcom._
          val newMap = attr.map{
            _.obj.map {
              case(v,p) => 
              lazy val tpia = p.to[TransformationPatternInAttributes].get
              SPAttributes(s"${op.name}" -> SPAttributes("atStart" -> SPAttributes(v -> tpia.atStart)),
                                                  "atExecute" -> SPAttributes(v -> tpia.atExecute),
                                                  "atComplete" -> SPAttributes(v -> tpia.atComplete))
                }
          }
          println(s"Newmap ${newMap}")
          newMap
        }

        def createConditions(remappedAttributes : List[SPAttributes]){

        }
        val reqAttrib = extractRequiredAttributes()
        println(s"reqAttrib ${reqAttrib}") //Here map start, execution and complete with relavent keys and add as gaurds
        val remappedAttr = remapAttr(reqAttrib)
        //createConditions(remappedAttr)
        op//.copy(attributes = remappedAttr)
      }

      val updatedOps = for {
        op <- ops
      }yield createConditionsFromAttributes(op.asInstanceOf[Operation])
      
      println(s"updatedOps: ${updatedOps}")
      // s.searchMethod match {
      //   case "theBad" => {
      //     println("HEJ")
      //     var iterations = 0
      //     val filter = ids.filter { x =>
      //       progress ! SPAttributes("iterations" -> iterations)
      //       iterations += 1
      //       if (s.onlyOperations && !x.isInstanceOf[Operation] || x.id == id) false
      //       else {
      //         val jsonID = SPValue(id)
      //         SPValue(x).find(_ == jsonID).isDefined
      //       }
      //     }
      //     sendResp(Response(filter, SPAttributes("setup" -> s), service, reqID), progress)
      //   }
      //   case "theGood" => {
      //     println("HEJ den bra")
      //     var iterations = 0
      //     val f2 = IDAbleLogic.removeID(Set(id), ids).map(_.id)
      //     val filter = ids.filter { x =>
      //       progress ! SPAttributes("iterations" -> iterations)
      //       iterations += 1
      //       f2.contains(x.id)
      //     }
      //     sendResp(Response(filter, SPAttributes("setup" -> s), service, reqID), progress)
      //   }
      // }
    }
    case (r : Response, reply: ActorRef) => {
      reply ! r
    }
    case ("boom", replyTo: ActorRef) => {
      replyTo ! SPError("BOOM")
      self ! PoisonPill
    }
    case x => {
      sender() ! SPError("What do you whant me to do? "+ x)
      self ! PoisonPill
    }
  }

  import scala.concurrent._
  import scala.concurrent.duration._
  def sendResp(r: Response, progress: ActorRef)(implicit rnr: RequestNReply) = {
    context.system.scheduler.scheduleOnce(2000 milliseconds, self, (r, rnr.reply))
    //context.system.scheduler.scheduleOnce(1000 milliseconds, self, ("boom", rnr.reply))

//    rnr.reply ! r
//    progress ! PoisonPill
//    self ! PoisonPill
  }

}



