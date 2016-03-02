package sp.runnerService

import akka.actor._
import sp.domain.Logic._
import sp.domain._
import sp.system._
import sp.system.messages._
import com.codemettle.reactivemq._
import com.codemettle.reactivemq.ReActiveMQMessages._
import com.codemettle.reactivemq.model._
import org.json4s.JsonAST.JInt
import sp.domain.logic.IDAbleLogic
import scala.concurrent._
import sp.system.messages._
import sp.system._
import sp.domain._
import sp.domain.Logic._
import sp.extensions._
import sp.psl.{ModelMaking, PSLModel}
import scala.util.Try
import sp.domain.SOP._


object RunnerService extends SPService {
  val specification = SPAttributes(
    "service" -> SPAttributes(
      "group"-> "runner",
      "description" -> "A service to run SOP's in SP"
    ),
    "SOP" -> KeyDefinition("Option[ID]", List(), Some("")
    ),
    "command" -> SPAttributes(
      "commandType"->KeyDefinition("String", List("connect", "disconnect", "status", "subscribe", "unsubscribe", "execute", "raw"), Some("connect"))
      )
  )

  val transformTuple  = (
    TransformValue("command", _.getAs[String]("command")),
    TransformValue("SOP", _.getAs[ID]("SOP"))
    )
  val transformation = transformToList(transformTuple.productIterator.toList)
  //def props(eventHandler: ActorRef) = Props(classOf[RunnerService], eventHandler)
  def props = ServiceLauncher.props(Props(classOf[RunnerService]))
}

//borde inte låta RunnerService ha ModelMaking trait egentligen....
class RunnerService extends Actor with ServiceSupport with ModelMaking {
  val serviceID = ID.newID

  def receive = {
    case r@Request(service, attr, ids, reqID) => {
      val replyTo = sender()
      implicit val rnr = RequestNReply(r, replyTo)

      val commands = transform(RunnerService.transformTuple._1)
      val sopID = transform(RunnerService.transformTuple._2)
      val core = r.attributes.getAs[ServiceHandlerAttributes]("core").get

      //lista av tuplar som vi gör om till map
      val idMap: Map[ID, IDAble] = ids.map(item => item.id -> item).toMap

      //sop:en finns i idMap, fås som IDAble, men vi gör en for comp så den fås som ID
      val sop = for {
        item <- idMap.get(sopID) if item.isInstanceOf[SOP]
      } yield {
        item.asInstanceOf[SOP]
      }

      //lista med id
      val list = sop.map(runASop)

      replyTo ! Response(List(), SPAttributes("result" -> "done"), rnr.req.service, rnr.req.reqID)
      self ! PoisonPill
    }
  }

  def runASop(sop:SOP): Future[String] = {
    sop match{
      case p: Parallel =>
        println(s"Nu är vi i parallel $p")
        val fSeq = p.sop.map(runASop)
        Future.sequence(fSeq).map{ list =>
          "done"//kolla sen så att alla verkligen är done!
        }
      case s: Sequence =>
        println(s"Nu är vi i sequence $s")
        if(s.sop.isEmpty) Future("done")
        else {
          val f = runASop(s.sop.head)
          f.flatMap(str => str match {
            case "done" =>
              runASop(Sequence(s.sop.tail))
          })
        }
      case h: Hierarchy =>
        println(s"Nu är vi i hierarki $h")
        val f = test(h.operation)
        f.map(x => x match {
          case "done" => "done" //return true
          case "error" => "nope"
        })
    }
  }

  def test(id: ID) = Future("done")

  def getOperation (sop: SOP) : List[Operation] = {
    val opList: List[Operation] = Nil
    for(o: Operation <- sop){
    opList :+ o
    }
    return opList
  }

  def execute (opList: List[Operation], sopType: String)={
    sopType match{
      case "parallel" =>{
        //execute(opList) - ska köra alla operationer i opList samtidigt
        //nya execute skickar till operation control
        //skicka något tillbaka som säger till när den exekverat klart
      }
      case "alternative"=>{
        //skicka på något sätt
      }
      case "sequence"=>{
        //for(o<-opList){execute(o), och skickar med när o är klar så nästa i for-loopen kan köra}
        //skickar tillbaka när hela opList har körts igenom så att for(s<- sopList ovan vet och kan skicka nästa sop till något annat)
      }
      case "hierarchy"=>{
        //skicka på något sätt
      }
      case "noMatch"=>{
        //skicka felmeddelande?
      }
    }
  }

  def getClassOfSop(sop: SOP): String ={
    sop match {
      case s: Parallel => "parallel"
      //case s: Alternative => "alternative"
      //case s: Arbitrary => "arbitrary"
      case s: Sequence => "sequence"
      //case s: SometimeSequence => "sometimeSequence"
      //case s: Other => "other"
      //case s: Hierarchy => "hierarchy"
      case _ => "noMatch"
    }
  }
}




