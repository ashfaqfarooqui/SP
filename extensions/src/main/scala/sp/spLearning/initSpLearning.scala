package sp.extensions.spLearning.HelloWorldSopService

object initSpLearning {
    def initService() = {
        import sp.system._
        import sp.system.SPActorSystem._
        import sp.domain.Logic._
        import sp.system.messages._

        serviceHandler ! RegisterService("HelloWorld",
            system.actorOf(HelloWorldSopService.props,"HelloWorld"),
            HelloWorldSopService.specification,
            HelloWorldSopService.transformation
            )
    }
    
}
