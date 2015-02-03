package sp.nina

import akka.actor._
import sp.domain._
import sp.system.messages._
import akka.pattern.ask
import akka.util._
import scala.concurrent.duration._

class NinaService extends Actor {
  private implicit val to = Timeout(2 seconds)

  import context.dispatcher
  import sp.system.SPActorSystem._
  
	def receive = {
	  case Request(_, attr) => {
	    val modelOption = attr.getAsID("model")
	    val operations = List(Operation("op1"), Operation("op2"))
	    
	    println(s"Vi klarade det: $modelOption")
	    
	    //modelHandler ! UpdateIDs(modelOption.get, -1, operations)
	    
	    
	    val ops = (modelHandler ? GetOperations(modelOption.get))
	    

	     
	     ops.map {
	      case SPIDs(ids) => {
	        ids map println
	      }
	      case x @ _ => println(s"Något blev fel: $x") 
	    }
	    
	    
	    sender ! "hej"
	  }
	}
  
  def extract(attr: SPAttributes) = {
    for {
      model <- attr.getAsID("model")
    } yield model
  }

  def errorMessage(attr: SPAttributes) = {
    SPError("The request is missing parameters: \n" +
      s"model: ${attr.getAsID("model")}" )
  }
  
}

object NinaService{
  def props = Props(classOf[NinaService])
}